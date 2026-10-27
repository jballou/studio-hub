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
        detail = (body.errorMessages ?? []).join("; ") || body.message || "";
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
    [field: string]: unknown;
  };
};

/** What a list needs. Left out on purpose: the description (rich text, by far the heaviest field), which only the ticket page shows. */
export const LIST_FIELDS = ["summary", "status", "issuetype", "reporter", "assignee", "duedate", "created", "customfield_10142", "resolutiondate", "parent"];

export const ISSUE_FIELDS = ["summary", "status", "issuetype", "reporter", "assignee", "duedate", "created", "description", "customfield_10142", "resolutiondate", "parent"];

// Jira calls its date field "Start date" but the id differs per site, so it is found by name once and remembered.
// Set JIRA_START_DATE_FIELD (e.g. customfield_10015) to skip the lookup.
let startField: { id: string | null; at: number } | null = null;

export async function startDateField(a: JiraAuth): Promise<string | null> {
  if (process.env.JIRA_START_DATE_FIELD) return process.env.JIRA_START_DATE_FIELD;
  // A found field is kept for the life of the server; "not found" is rechecked every 10 minutes.
  if (startField && (startField.id || Date.now() - startField.at < 600_000)) return startField.id;
  // A found id is also saved in our own store, so a fresh server instance doesn't spend a Jira call on it.
  const saved = await readDoc<{ startDateField?: string }>("jira-fields", () => ({})).then((d) => d.data.startDateField ?? null).catch(() => null);
  if (saved) { startField = { id: saved, at: Date.now() }; return saved; }
  try {
    const all = await request<{ id: string; name: string; custom?: boolean; schema?: { type?: string } }[]>(a, "/field");
    const hit = all.find((f) => f.name.toLowerCase() === "start date" && f.custom !== false && (f.schema?.type === "date" || f.schema?.type === "datetime")) ?? all.find((f) => f.name.toLowerCase() === "start date");
    startField = { id: hit?.id ?? null, at: Date.now() };
    if (hit) await updateDoc("jira-fields", () => ({}), (d) => ({ data: { ...d, startDateField: hit.id }, result: undefined })).catch(() => {});
  } catch {
    return null; // can't tell right now; try again next request
  }
  return startField.id;
}

/** Moves the discovered start date field's value to `fields.startDate` (null when empty) so the rest of the app doesn't need its id. */
function withStartDate(issue: JiraIssue, id: string | null): JiraIssue {
  if (id) issue.fields.startDate = (issue.fields[id] as string | null | undefined) ?? null;
  return issue;
}

export async function searchIssues(a: JiraAuth, jql: string, fields: string[] = ISSUE_FIELDS, maxResults = 50): Promise<JiraIssue[]> {
  const sf = fields === ISSUE_FIELDS || fields === LIST_FIELDS ? await startDateField(a) : null;
  const qs = new URLSearchParams({ jql, fields: (sf ? [...fields, sf] : fields).join(","), maxResults: String(maxResults) });
  const data = await request<{ issues: JiraIssue[] }>(a, `/search/jql?${qs}`);
  return data.issues.map((i) => withStartDate(i, sf));
}

export async function getIssue(a: JiraAuth, key: string): Promise<JiraIssue> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  const sf = await startDateField(a);
  return withStartDate(await request<JiraIssue>(a, `/issue/${key}?fields=${(sf ? [...ISSUE_FIELDS, sf] : ISSUE_FIELDS).join(",")}`), sf);
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

/**
 * Moves a ticket to the status with this name, using whichever transition leads there.
 * Needs the write:jira-work scope; a token without it gets a 401/403 from Jira, which the caller reports plainly.
 */
export async function transitionToStatus(a: JiraAuth, key: string, statusName: string): Promise<TransitionResult> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  const issue = await getIssue(a, key);
  if (issue.fields.status.name.toLowerCase() === statusName.toLowerCase()) return "already";
  const { transitions } = await request<{ transitions: { id: string; to: { name: string } }[] }>(a, `/issue/${key}/transitions`);
  const t = transitions.find((x) => x.to.name.toLowerCase() === statusName.toLowerCase());
  if (!t) return "no-transition";
  await request<void>(a, `/issue/${key}/transitions`, { method: "POST", body: { transition: { id: t.id } } });
  return "moved";
}

export type TargetStatus = { name: string; category: "new" | "indeterminate" | "done" };

/** Statuses this ticket can be moved to right now (by the signed-in person), without the one it's already in. */
export async function listTargetStatuses(a: JiraAuth, key: string): Promise<TargetStatus[]> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  const [issue, { transitions }] = await Promise.all([
    getIssue(a, key),
    request<{ transitions: { to: { name: string; statusCategory: { key: string } } }[] }>(a, `/issue/${key}/transitions`),
  ]);
  const seen = new Set<string>([issue.fields.status.name.toLowerCase()]);
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
