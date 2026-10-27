// Server-side Jira REST client. Always called with the signed-in user's token, so Jira's own
// Browse permissions decide what comes back. Never import this from a client component.

export class JiraError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type JiraAuth = { accessToken: string; cloudId: string };

const api = (a: JiraAuth, path: string) => `https://api.atlassian.com/ex/jira/${a.cloudId}/rest/api/3${path}`;

async function request<T>(a: JiraAuth, path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(api(a, path), {
    method: init?.method,
    headers: { Authorization: `Bearer ${a.accessToken}`, Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
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

export type JiraUser = { accountId: string; displayName: string; emailAddress?: string };
export type JiraIssue = {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    issuetype: { name: string };
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

export const ISSUE_FIELDS = ["summary", "status", "issuetype", "reporter", "assignee", "duedate", "created", "description", "customfield_10142", "resolutiondate"];

// Jira calls its date field "Start date" but the id differs per site, so it is found by name once and remembered.
// Set JIRA_START_DATE_FIELD (e.g. customfield_10015) to skip the lookup.
let startField: { id: string | null; at: number } | null = null;

export async function startDateField(a: JiraAuth): Promise<string | null> {
  if (process.env.JIRA_START_DATE_FIELD) return process.env.JIRA_START_DATE_FIELD;
  // A found field is kept for the life of the server; "not found" is rechecked every 10 minutes.
  if (startField && (startField.id || Date.now() - startField.at < 600_000)) return startField.id;
  try {
    const all = await request<{ id: string; name: string; custom?: boolean; schema?: { type?: string } }[]>(a, "/field");
    const hit = all.find((f) => f.name.toLowerCase() === "start date" && f.custom !== false && (f.schema?.type === "date" || f.schema?.type === "datetime")) ?? all.find((f) => f.name.toLowerCase() === "start date");
    startField = { id: hit?.id ?? null, at: Date.now() };
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
  const sf = fields === ISSUE_FIELDS ? await startDateField(a) : null;
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
