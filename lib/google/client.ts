// Server-side Google client: OAuth, Calendar (read) and Tasks (write). Tokens never reach the browser.
import { cacheAccessToken, getConnection, markBroken, type GoogleConn } from "@/lib/store/google";

export const SCOPES = [
  "openid",
  "email",
  // Read-only: the app only looks at the day's events.
  "https://www.googleapis.com/auth/calendar.events.readonly",
  // Read/write, but the app only touches its own "Brand Creative Hub" list.
  "https://www.googleapis.com/auth/tasks",
  // Read-only: lets the review player stream a Drive video or audio file to people who can already open it in Drive.
  "https://www.googleapis.com/auth/drive.readonly",
];
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
/** Not in SCOPES on purpose: only an admin who syncs the OKR Sheet is asked for it (/api/google/connect?sheets=1). */
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export class GoogleError extends Error {
  constructor(public status: number, message: string, public code?: "not-connected" | "reconnect" | "not-configured") {
    super(message);
  }
}

export const configured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export function authUrl(redirectUri: string, state: string, loginHint?: string, extraScopes: string[] = []): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...SCOPES, ...extraScopes].join(" "),
    access_type: "offline",
    // Without this Google only returns a refresh token the first time ever.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) p.set("login_hint", loginHint);
  // hd narrows the account chooser to the company's Google Workspace (checked again after sign-in).
  p.set("hd", "surveymonkey.com");
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenRes = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string; error?: string };

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenRes> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const data = (await res.json()) as TokenRes;
  if (!res.ok) throw new GoogleError(502, "Google didn't accept the sign-in. Try connecting again.");
  return data;
}

/** The email in Google's ID token. It came straight from Google's token endpoint over TLS in the same request. */
export function idTokenEmail(idToken?: string): { email: string; verified: boolean } | null {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString());
    return { email: String(payload.email ?? "").toLowerCase(), verified: payload.email_verified === true };
  } catch {
    return null;
  }
}

async function accessToken(email: string, conn: GoogleConn): Promise<string> {
  if (conn.accessToken && conn.expiresAt && Date.now() / 1000 < conn.expiresAt - 60) return conn.accessToken;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", refresh_token: conn.refreshToken, grant_type: "refresh_token" }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenRes;
  if (!res.ok) {
    if (data.error === "invalid_grant") {
      await markBroken(email).catch(() => {});
      throw new GoogleError(401, "Google access expired or was revoked. Reconnect Google.", "reconnect");
    }
    throw new GoogleError(502, "Couldn't reach Google.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await cacheAccessToken(email, data.access_token, expiresAt).catch(() => {});
  return data.access_token;
}

async function gfetch<T>(email: string, url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!configured()) throw new GoogleError(501, "Google isn't set up for this app yet.", "not-configured");
  const conn = await getConnection(email);
  if (!conn) throw new GoogleError(409, "Google isn't connected.", "not-connected");
  if (conn.broken && !conn.accessToken) throw new GoogleError(401, "Reconnect Google.", "reconnect");
  const token = await accessToken(email, conn);
  const res = await fetch(url, {
    method: init?.method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    if (res.status === 401) throw new GoogleError(401, "Reconnect Google.", "reconnect");
    if (res.status === 403) throw new GoogleError(403, "Google didn't allow that. Reconnect and accept every permission.", "reconnect");
    if (res.status === 404 || res.status === 410) throw new GoogleError(404, "Not found in Google.");
    throw new GoogleError(502, `Google returned HTTP ${res.status}.`);
  }
  return res.json() as Promise<T>;
}

/** Cell values for one or more ranges of a Google Sheet, as displayed. Needs the Sheets read scope (admins only, see SHEETS_SCOPE). */
export async function sheetValues(email: string, spreadsheetId: string, ranges: string[]): Promise<string[][][]> {
  const conn = await getConnection(email);
  if (conn && !conn.scopes.includes(SHEETS_SCOPE)) throw new GoogleError(403, "Reconnect Google and allow reading Google Sheets.", "reconnect");
  const qs = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE", majorDimension: "ROWS" });
  ranges.forEach((r) => qs.append("ranges", r));
  const data = await gfetch<{ valueRanges?: { values?: unknown[][] }[] }>(email, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${qs}`);
  return (data.valueRanges ?? []).map((v) => (v.values ?? []).map((row) => row.map((c) => String(c ?? ""))));
}

export type GEvent = {
  id: string;
  title: string;
  /** ISO datetime, or YYYY-MM-DD for all-day events */
  start: string;
  end: string;
  allDay: boolean;
  link?: string;
  meetLink?: string;
  location?: string;
  /** "accepted" | "tentative" | "needsAction" | "declined" for the signed-in person */
  response?: string;
  attendees: number;
};

type RawEvent = {
  id: string; status?: string; summary?: string; htmlLink?: string; hangoutLink?: string; location?: string;
  start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  eventType?: string;
};

/** Events on the person's primary calendar between two instants. Declined and cancelled events are dropped. */
export async function listEvents(email: string, fromIso: string, toIso: string): Promise<GEvent[]> {
  const qs = new URLSearchParams({ timeMin: fromIso, timeMax: toIso, singleEvents: "true", orderBy: "startTime", maxResults: "100" });
  const data = await gfetch<{ items?: RawEvent[] }>(email, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs}`);
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled" && e.start && e.end && !["outOfOffice", "focusTime", "workingLocation"].includes(e.eventType ?? ""))
    .map((e): GEvent => ({
      id: e.id,
      title: e.summary || "(No title)",
      start: e.start!.dateTime ?? e.start!.date!,
      end: e.end!.dateTime ?? e.end!.date!,
      allDay: !e.start!.dateTime,
      link: e.htmlLink,
      meetLink: e.hangoutLink,
      location: e.location,
      response: e.attendees?.find((a) => a.self)?.responseStatus,
      attendees: e.attendees?.length ?? 0,
    }))
    .filter((e) => e.response !== "declined");
}

const LIST_TITLE = "Brand Creative Hub";

/** Finds (or creates) the one Google Tasks list the app writes to. */
export async function ensureTaskList(email: string): Promise<string> {
  const lists = await gfetch<{ items?: { id: string; title: string }[] }>(email, "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100");
  const found = lists.items?.find((l) => l.title === LIST_TITLE);
  if (found) return found.id;
  const made = await gfetch<{ id: string }>(email, "https://tasks.googleapis.com/tasks/v1/users/@me/lists", { method: "POST", body: { title: LIST_TITLE } });
  return made.id;
}

export type GTaskInput = { title: string; notes?: string; /** YYYY-MM-DD */ dueDate?: string; done: boolean };

const body = (t: GTaskInput) => ({
  title: t.title,
  notes: t.notes,
  // Google Tasks keeps only the date of `due`; the time is carried in the notes.
  due: t.dueDate ? `${t.dueDate}T00:00:00.000Z` : null,
  status: t.done ? "completed" : "needsAction",
  ...(t.done ? {} : { completed: null }),
});

export async function createGTask(email: string, listId: string, t: GTaskInput): Promise<string> {
  const r = await gfetch<{ id: string }>(email, `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, { method: "POST", body: body(t) });
  return r.id;
}
export async function updateGTask(email: string, listId: string, id: string, t: GTaskInput): Promise<void> {
  await gfetch(email, `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${id}`, { method: "PATCH", body: body(t) });
}
export async function deleteGTask(email: string, listId: string, id: string): Promise<void> {
  try {
    await gfetch(email, `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${id}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof GoogleError && e.status === 404)) throw e; // already gone
  }
}

/** The app's list if it exists; never creates one. */
export async function findTaskList(email: string): Promise<string | null> {
  const lists = await gfetch<{ items?: { id: string; title: string }[] }>(email, "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100");
  return lists.items?.find((l) => l.title === LIST_TITLE)?.id ?? null;
}

export type GTask = { id: string; title: string; notes?: string; /** YYYY-MM-DD */ due?: string; done: boolean; completedAt?: string; updatedAt?: string };

/** Every task in a list, finished ones included (up to 500). */
export async function listGTasks(email: string, listId: string): Promise<GTask[]> {
  const out: GTask[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ showCompleted: "true", showHidden: "true", showDeleted: "false", maxResults: "100", ...(pageToken ? { pageToken } : {}) });
    const data = await gfetch<{ items?: { id: string; title?: string; notes?: string; due?: string; status?: string; completed?: string; updated?: string; deleted?: boolean }[]; nextPageToken?: string }>(email, `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?${qs}`);
    for (const t of data.items ?? []) {
      if (t.deleted || !t.title?.trim()) continue;
      out.push({ id: t.id, title: t.title.trim(), notes: t.notes, due: t.due?.slice(0, 10), done: t.status === "completed", completedAt: t.completed, updatedAt: t.updated });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
}

/** Throws "reconnect" unless this person's Google connection includes Drive access. */
async function assertDrive(email: string): Promise<void> {
  const conn = await getConnection(email);
  if (conn && !conn.scopes.includes(DRIVE_SCOPE)) throw new GoogleError(403, "Reconnect Google and allow access to Drive files.", "reconnect");
}

export type DriveFile = { id: string; name: string; mimeType: string; size?: number; width?: number; height?: number };

/** Name, type and shape of a Drive file the person can open. */
export async function driveFile(email: string, id: string): Promise<DriveFile> {
  await assertDrive(email);
  const qs = new URLSearchParams({ supportsAllDrives: "true", fields: "id,name,mimeType,size,videoMediaMetadata(width,height)" });
  const f = await gfetch<{ id: string; name: string; mimeType: string; size?: string; videoMediaMetadata?: { width?: number; height?: number } }>(email, `https://www.googleapis.com/drive/v3/files/${id}?${qs}`);
  return { id: f.id, name: f.name, mimeType: f.mimeType, size: f.size ? Number(f.size) : undefined, width: f.videoMediaMetadata?.width, height: f.videoMediaMetadata?.height };
}

/** The file's bytes (or the requested range) as Google sends them, for streaming straight on to the browser. */
export async function driveMedia(email: string, id: string, range: string | null): Promise<Response> {
  if (!configured()) throw new GoogleError(501, "Google isn't set up for this app yet.", "not-configured");
  const conn = await getConnection(email);
  if (!conn) throw new GoogleError(409, "Google isn't connected.", "not-connected");
  if (!conn.scopes.includes(DRIVE_SCOPE)) throw new GoogleError(403, "Reconnect Google and allow access to Drive files.", "reconnect");
  if (conn.broken && !conn.accessToken) throw new GoogleError(401, "Reconnect Google.", "reconnect");
  const token = await accessToken(email, conn);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
    cache: "no-store",
  });
  if (res.status === 401) throw new GoogleError(401, "Reconnect Google.", "reconnect");
  if (res.status === 403) throw new GoogleError(403, "Drive didn't let you open that file.");
  if (res.status === 404) throw new GoogleError(404, "That Drive file wasn't found, or you can't open it.");
  return res;
}

// ---- Brand library: browsing a shared Drive folder with one person's connection ----

// Drive answers are remembered briefly in memory: a folder's list, a file's name and parents, and a file's preview link.
// A grid of 100 photos would otherwise cost 100+ metadata calls on top of the 100 image fetches.
const memo = new Map<string, { at: number; v: unknown }>();
const remembered = <T>(k: string, ttl: number): T | undefined => { const h = memo.get(k); return h && Date.now() - h.at < ttl ? (h.v as T) : undefined; };
const remember = (k: string, v: unknown) => { memo.set(k, { at: Date.now(), v }); if (memo.size > 3000) memo.delete(memo.keys().next().value as string); };

export type DriveItem = { id: string; name: string; mimeType: string; folder: boolean; size?: number; width?: number; height?: number };
export const DRIVE_FOLDER = "application/vnd.google-apps.folder";

/** Children of a Drive folder (folders first, then by name), up to 400. */
export async function driveList(email: string, folderId: string): Promise<DriveItem[]> {
  const kept = remembered<DriveItem[]>(`list|${folderId}`, 120_000);
  if (kept) return kept;
  await assertDrive(email);
  const out: DriveItem[] = [];
  let page: string | undefined;
  do {
    const qs = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,name,mimeType,size,thumbnailLink,imageMediaMetadata(width,height))",
      orderBy: "folder,name_natural",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (page) qs.set("pageToken", page);
    const r = await gfetch<{ nextPageToken?: string; files?: { id: string; name: string; mimeType: string; size?: string; thumbnailLink?: string; imageMediaMetadata?: { width?: number; height?: number } }[] }>(email, `https://www.googleapis.com/drive/v3/files?${qs}`);
    for (const f of r.files ?? []) { if (f.thumbnailLink) remember(`thumb|${f.id}`, f.thumbnailLink); out.push({ id: f.id, name: f.name, mimeType: f.mimeType, folder: f.mimeType === DRIVE_FOLDER, size: f.size ? Number(f.size) : undefined, width: f.imageMediaMetadata?.width, height: f.imageMediaMetadata?.height }); }
    page = r.nextPageToken;
  } while (page && out.length < 400);
  remember(`list|${folderId}`, out);
  return out;
}

/** A file's name, type and parent folders. */
export async function driveNode(email: string, id: string): Promise<{ id: string; name: string; mimeType: string; parents: string[] }> {
  const kept = remembered<{ id: string; name: string; mimeType: string; parents: string[] }>(`node|${id}`, 600_000);
  if (kept) return kept;
  await assertDrive(email);
  const qs = new URLSearchParams({ supportsAllDrives: "true", fields: "id,name,mimeType,parents" });
  const f = await gfetch<{ id: string; name: string; mimeType: string; parents?: string[] }>(email, `https://www.googleapis.com/drive/v3/files/${id}?${qs}`);
  const node = { id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents ?? [] };
  remember(`node|${id}`, node);
  return node;
}

/** Drive's own preview image for a file, as a response to stream on. `size` is the longest edge in pixels. */
export async function driveThumbnail(email: string, id: string, size: number): Promise<Response> {
  await assertDrive(email);
  // The folder list already carried each file's preview link, so this is usually one fetch, not two.
  let link = remembered<string>(`thumb|${id}`, 1_800_000);
  if (!link) {
    const qs = new URLSearchParams({ supportsAllDrives: "true", fields: "thumbnailLink" });
    link = (await gfetch<{ thumbnailLink?: string }>(email, `https://www.googleapis.com/drive/v3/files/${id}?${qs}`)).thumbnailLink;
    if (link) remember(`thumb|${id}`, link);
  }
  if (!link) throw new GoogleError(404, "No preview for that file.");
  const res = await fetch(link.replace(/=s\d+$/, `=s${size}`), { cache: "no-store" });
  if (!res.ok) throw new GoogleError(502, "Drive couldn't make a preview.");
  return res;
}
