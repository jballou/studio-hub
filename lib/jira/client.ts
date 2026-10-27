import { readDoc, updateDoc } from "@/lib/store/doc";

// Server-side Jira REST client. Always called with the signed-in user's token, so Jira's own
// Browse permissions decide what comes back. Never import this from a client component.

export class JiraError extends Error {
  constructor(public status: number, message: string, public extra: { retryAfter?: number; reason?: string } = {}) {
    super(message);
  }
  /** Seconds Jira asked us to wait (429 only). */
  get retryAfter() { return this.extra.retryAfter; }
  /** Which of Atlassian's limits fired, when it says (429 only). */
  get reason() { return this.extra.reason; }
}

export type JiraAuth = { accessToken: string; cloudId: string };

const api = (a: JiraAuth, path: string) => `https://api.atlassian.com/ex/jira/${a.cloudId}/rest/api/3${path}`;

// ---- Staying inside Jira's rate limits ----
// Atlassian limits an app by points per hour and by bursts. We keep bursts small (at most 4 calls in flight per server
// instance) and, when Jira says 429, wait as long as it asks (capped) and try again. A 429 means "not processed", so
// retrying even a write is safe. 503 is retried for reads only.
const MAX_IN_FLIGHT = 4;
const MAX_RETRIES = 2;
const MAX_WAIT_MS = 4000;
/** Swappable so tests don't have to wait. */
export const retry = { sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };

let inFlight = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((r) => waiting.push(r));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}

/** Retry-After in seconds. Atlassian sends whole seconds; anything else is ignored. */
export function parseRetryAfter(v: string | null): number | undefined {
  if (!v || !/^\d+(\.\d+)?$/.test(v.trim())) return undefined;
  return Math.max(0, Math.ceil(Number(v)));
}

/** Any Jira call with the retry and burst protection above. Prefer the named helpers; this is for writes that have none. */
export const jiraRequest = <T>(a: JiraAuth, path: string, init?: { method: string; body?: unknown }): Promise<T> => request<T>(a, path, init);

async function request<T>(a: JiraAuth, path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const method = init?.method ?? "GET";
  for (let attempt = 0; ; attempt++) {
    const res = await slot(() => fetch(api(a, path), {
      method: init?.method,
      headers: { Authorization: `Bearer ${a.accessToken}`, Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    }));
    const limited = res.status === 429 || (res.status === 503 && method === "GET");
    if (limited) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      if (attempt < MAX_RETRIES) {
        const wait = Math.min(retryAfter !== undefined ? retryAfter * 1000 : 1000 * 2 ** attempt, MAX_WAIT_MS);
        await retry.sleep(wait + Math.random() * 250);
        continue;
      }
      throw new JiraError(res.status === 429 ? 429 : 503, "Jira is busy right now.", { retryAfter, reason: res.headers.get("ratelimit-reason") ?? res.headers.get("x-ratelimit-reason") ?? undefined });
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        // Jira names the field it refused in `errors` (e.g. "customfield_10142: …"); show it rather than a bare "400".
        detail = [...(body.errorMessages ?? []), ...Object.entries(body.errors ?? {}).map(([k, v]) => `${k}: ${v}`)].join("; ") || body.message || "";
      } catch { /* non-JSON error body */ }
      throw new JiraError(res.status, detail || `Jira returned HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
}

export type JiraUser = { accountId: string; displayName: string; emailAddress?: string };
export type JiraIssue = {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    issuetype: { name: string; hierarchyLevel?: number };
    parent?: { key: string; fields?: { summary?: string; status?: { name: string; statusCategory: { key: string } }; issuetype?: { name: string; hierarchyLevel?: number } } } | null;
    reporter?: JiraUser | null;
    assignee?: JiraUser | null;
    duedate?: string | null;
    created: string;
    description?: unknown;
    customfield_10142?: JiraUser[] | null; // "Cc" user picker
    resolutiondate?: string | null;
    /** the site's Start date field, copied here by startDateField/withStartDate */
    startDate?: string | null;
    /** the site's Requestor people field, copied here (null when empty) */
    requestor?: JiraUser | null;
    labels?: string[];
    [field: string]: unknown;
  };
};

/**
 * What a list needs. Left out on purpose: the description (rich text) and the Cc people. Jira charges quota per object
 * returned, and each person counts double, so the ticket page is the only place that asks for Cc.
 */
export const LIST_FIELDS = ["summary", "status", "issuetype", "reporter", "assignee", "duedate", "created", "resolutiondate", "parent"];

/** Field-list token: "ask for the Requestor field, whatever its id is on this site". */
const REQUESTOR_TOKEN = "@requestor";

/** My Briefs: a list plus the Requestor, labels (to tell Hub-made briefs apart) and the description for the card's summary. */
export const BRIEF_FIELDS = [...LIST_FIELDS, "labels", "description", REQUESTOR_TOKEN];

export const ISSUE_FIELDS = ["summary", "status", "issuetype", "reporter", "assignee", "duedate", "created", "description", "customfield_10142", "resolutiondate", "parent"];

// Some fields have site-specific ids (Start date, Requestor), so they are found by name once and remembered, both in
// memory and in our own store, so a fresh server instance doesn't spend a Jira call on it.
// Set JIRA_START_DATE_FIELD / JIRA_REQUESTOR_FIELD (e.g. customfield_10015) to skip the lookup.
type FieldKey = "startDateField" | "requestorField";
type RawField = { id: string; name: string; custom?: boolean; schema?: { type?: string } };
const found = new Map<FieldKey, { id: string | null; at: number }>();

async function namedField(a: JiraAuth, key: FieldKey, env: string | undefined, pick: (all: RawField[]) => RawField | undefined): Promise<string | null> {
  if (env) return env;
  // A found field is kept for the life of the server; "not found" is rechecked every 10 minutes.
  const mem = found.get(key);
  if (mem && (mem.id || Date.now() - mem.at < 600_000)) return mem.id;
  const saved = await readDoc<Partial<Record<FieldKey, string>>>("jira-fields", () => ({})).then((d) => d.data[key] ?? null).catch(() => null);
  if (saved) { found.set(key, { id: saved, at: Date.now() }); return saved; }
  try {
    const hit = pick(await request<RawField[]>(a, "/field"));
    found.set(key, { id: hit?.id ?? null, at: Date.now() });
    if (hit) await updateDoc<Partial<Record<FieldKey, string>>>("jira-fields", () => ({}), (d) => ({ data: { ...d, [key]: hit.id }, result: undefined })).catch(() => {});
  } catch {
    return null; // can't tell right now; try again next request
  }
  return found.get(key)?.id ?? null;
}

export const startDateField = (a: JiraAuth) => namedField(a, "startDateField", process.env.JIRA_START_DATE_FIELD, (all) => {
  const named = all.filter((f) => f.name.toLowerCase() === "start date");
  return named.find((f) => f.custom !== false && (f.schema?.type === "date" || f.schema?.type === "datetime")) ?? named[0];
});

/** The "Requestor" (or "Requester") people field, when the site has one. Falls back to the reporter when it doesn't. */
export const requestorField = (a: JiraAuth) => namedField(a, "requestorField", process.env.JIRA_REQUESTOR_FIELD, (all) => {
  const named = all.filter((f) => ["requestor", "requester"].includes(f.name.toLowerCase()) && f.custom !== false);
  return named.find((f) => f.schema?.type === "user") ?? named[0];
});

/** Copies the discovered fields' values onto `fields.startDate` / `fields.requestor` so the rest of the app doesn't need their ids. */
function withNamed(issue: JiraIssue, ids: { start: string | null; requestor: string | null }): JiraIssue {
  if (ids.start) issue.fields.startDate = (issue.fields[ids.start] as string | null | undefined) ?? null;
  if (ids.requestor) issue.fields.requestor = (issue.fields[ids.requestor] as JiraUser | null | undefined) ?? null;
  return issue;
}

const REQUESTOR = REQUESTOR_TOKEN;

export async function searchIssues(a: JiraAuth, jql: string, fields: string[] = ISSUE_FIELDS, maxResults = 50): Promise<JiraIssue[]> {
  const wantsStart = fields === ISSUE_FIELDS || fields === LIST_FIELDS || fields === BRIEF_FIELDS;
  const start = wantsStart ? await startDateField(a) : null;
  const requestor = fields.includes(REQUESTOR) ? await requestorField(a) : null;
  const asked = [...fields.filter((f) => f !== REQUESTOR), ...(start ? [start] : []), ...(requestor ? [requestor] : [])];
  const qs = new URLSearchParams({ jql, fields: asked.join(","), maxResults: String(maxResults) });
  const data = await request<{ issues: JiraIssue[] }>(a, `/search/jql?${qs}`);
  return data.issues.map((i) => withNamed(i, { start, requestor }));
}

export async function getIssue(a: JiraAuth, key: string): Promise<JiraIssue> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  const [start, requestor] = await Promise.all([startDateField(a), requestorField(a)]);
  const asked = [...ISSUE_FIELDS, ...(start ? [start] : []), ...(requestor ? [requestor] : [])];
  return withNamed(await request<JiraIssue>(a, `/issue/${key}?fields=${asked.join(",")}`), { start, requestor });
}

/** Sets the ticket's start date (YYYY-MM-DD). Needs write:jira-work and edit permission on the ticket. */
export async function setStartDate(a: JiraAuth, key: string, date: string): Promise<void> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new JiraError(400, "That date doesn't look right.");
  const sf = await startDateField(a);
  if (!sf) throw new JiraError(409, "This Jira site has no Start date field the app can use.");
  await request<void>(a, `/issue/${key}`, { method: "PUT", body: { fields: { [sf]: date } } });
}

/** Quotes a value for use inside a JQL string literal. */
export const jqlString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Looks up the Jira site id for JIRA_SITE_URL among the sites this token can reach. */
export async function findCloudId(accessToken: string): Promise<string | undefined> {
  const site = (process.env.JIRA_SITE_URL ?? "").replace(/\/$/, "");
  try {
    const res = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const sites: { id: string; url: string }[] = await res.json();
    return sites.find((x) => x.url.replace(/\/$/, "") === site)?.id;
  } catch {
    return undefined;
  }
}

export type JiraPerson = { accountId: string; displayName: string; emailAddress?: string; active?: boolean; accountType?: string };

/** Active human accounts matching a name or email fragment. Runs as the signed-in user, so Jira's own visibility rules apply. */
export async function searchUsers(a: JiraAuth, query: string, limit = 8): Promise<JiraPerson[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  try {
    const qs = new URLSearchParams({ query: q, maxResults: String(Math.min(limit * 3, 50)) });
    const users = await request<JiraPerson[]>(a, `/user/search?${qs}`);
    return users.filter((u) => u.active !== false && (!u.accountType || u.accountType === "atlassian")).slice(0, limit);
  } catch (e) {
    // Some sites restrict user search; the picker endpoint (what Jira's own people fields use) is the fallback.
    if (!(e instanceof JiraError) || (e.status !== 403 && e.status !== 404)) throw e;
    const qs = new URLSearchParams({ query: q, maxResults: String(limit) });
    const data = await request<{ users: { accountId: string; displayName: string; accountType?: string; html?: string }[] }>(a, `/user/picker?${qs}`);
    return data.users
      .filter((u) => !u.accountType || u.accountType === "atlassian")
      .map((u) => ({ accountId: u.accountId, displayName: u.displayName, emailAddress: u.html?.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] }));
  }
}

export type TransitionResult = "moved" | "already" | "no-transition";

type RawTransition = { id: string; to: { name: string; statusCategory: { key: string } } };
/** A ticket's current status and the moves Jira offers right now. Two small calls; callers that need both share one result. */
export type TransitionInfo = { current: string; transitions: RawTransition[] };

export async function transitionInfo(a: JiraAuth, key: string): Promise<TransitionInfo> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  const [issue, { transitions }] = await Promise.all([
    getIssueFields(a, key, ["status"]),
    request<{ transitions: RawTransition[] }>(a, `/issue/${key}/transitions`),
  ]);
  return { current: issue.fields.status.name, transitions };
}

/**
 * Moves a ticket to the status with this name, using whichever transition leads there.
 * Pass `info` when you already have it, so the move costs one call instead of three.
 * Needs the write:jira-work scope; a token without it gets a 401/403 from Jira, which the caller reports plainly.
 */
export async function transitionToStatus(a: JiraAuth, key: string, statusName: string, info?: TransitionInfo): Promise<TransitionResult> {
  const { current, transitions } = info ?? (await transitionInfo(a, key));
  if (current.toLowerCase() === statusName.toLowerCase()) return "already";
  const t = transitions.find((x) => x.to.name.toLowerCase() === statusName.toLowerCase());
  if (!t) return "no-transition";
  await request<void>(a, `/issue/${key}/transitions`, { method: "POST", body: { transition: { id: t.id } } });
  return "moved";
}

export type TargetStatus = { name: string; category: "new" | "indeterminate" | "done" };

/** Statuses this ticket can be moved to right now (by the signed-in person), without the one it's already in. */
export async function listTargetStatuses(a: JiraAuth, key: string, info?: TransitionInfo): Promise<TargetStatus[]> {
  const { current, transitions } = info ?? (await transitionInfo(a, key));
  const seen = new Set<string>([current.toLowerCase()]);
  const out: TargetStatus[] = [];
  for (const t of transitions) {
    const n = t.to.name;
    if (seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push({ name: n, category: (t.to.statusCategory.key as TargetStatus["category"]) ?? "indeterminate" });
  }
  return out;
}

/** One ticket with just the fields asked for. Used for parents and links, where the full set isn't needed. */
export async function getIssueFields(a: JiraAuth, key: string, fields: string[]): Promise<JiraIssue> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  return request<JiraIssue>(a, `/issue/${key}?fields=${fields.join(",")}`);
}

/** The permissions this sign-in token actually holds on the Jira site (Atlassian reports them per site). Null if it can't be read. */
export async function tokenScopes(a: JiraAuth): Promise<string[] | null> {
  try {
    const res = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${a.accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const sites: { id: string; scopes?: string[] }[] = await res.json();
    return sites.find((x) => x.id === a.cloudId)?.scopes ?? null;
  } catch {
    return null;
  }
}

export type ChangeHistory = { id: string; created: string; author?: { displayName?: string; accountId?: string }; items: { field: string; fromString?: string | null; toString?: string | null }[] };

/** A search that also returns each ticket's change history. Costly, so callers keep it small and cached. */
export async function searchWithChangelog(a: JiraAuth, jql: string, maxResults: number): Promise<{ key: string; fields: { summary: string; updated: string }; changelog?: { histories?: ChangeHistory[] } }[]> {
  const qs = new URLSearchParams({ jql, fields: "summary,updated", expand: "changelog", maxResults: String(maxResults) });
  const data = await request<{ issues: { key: string; fields: { summary: string; updated: string }; changelog?: { histories?: ChangeHistory[] } }[] }>(a, `/search/jql?${qs}`);
  return data.issues;
}
