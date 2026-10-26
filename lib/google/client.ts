// Server-side Google client: OAuth, Calendar (read) and Tasks (write). Tokens never reach the browser.
import { cacheAccessToken, getConnection, markBroken, type GoogleConn } from "@/lib/store/google";

export const SCOPES = [
  "openid",
  "email",
  // Read-only: the app only looks at the day's events.
  "https://www.googleapis.com/auth/calendar.events.readonly",
  // Read/write, but the app only touches its own "Brand Creative Hub" list.
  "https://www.googleapis.com/auth/tasks",
];

export class GoogleError extends Error {
  constructor(public status: number, message: string, public code?: "not-connected" | "reconnect" | "not-configured") {
    super(message);
  }
}

export const configured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export function authUrl(redirectUri: string, state: string, loginHint?: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
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
