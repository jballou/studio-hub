// Server-side Jira REST client. Always called with the signed-in user's token, so Jira's own
// Browse permissions decide what comes back. Never import this from a client component.

export class JiraError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type JiraAuth = { accessToken: string; cloudId: string };

const api = (a: JiraAuth, path: string) => `https://api.atlassian.com/ex/jira/${a.cloudId}/rest/api/3${path}`;

async function request<T>(a: JiraAuth, path: string): Promise<T> {
  const res = await fetch(api(a, path), {
    headers: { Authorization: `Bearer ${a.accessToken}`, Accept: "application/json" },
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
    [field: string]: unknown;
  };
};

export const ISSUE_FIELDS = ["summary", "status", "issuetype", "reporter", "assignee", "duedate", "created", "description", "customfield_10142"];

export async function searchIssues(a: JiraAuth, jql: string, fields: string[] = ISSUE_FIELDS, maxResults = 50): Promise<JiraIssue[]> {
  const qs = new URLSearchParams({ jql, fields: fields.join(","), maxResults: String(maxResults) });
  const data = await request<{ issues: JiraIssue[] }>(a, `/search/jql?${qs}`);
  return data.issues;
}

export async function getIssue(a: JiraAuth, key: string): Promise<JiraIssue> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  return request<JiraIssue>(a, `/issue/${key}?fields=${ISSUE_FIELDS.join(",")}`);
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
