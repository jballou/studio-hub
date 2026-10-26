import { getToken } from "next-auth/jwt";
import { findCloudId, JiraError, type JiraAuth } from "./client";

export type JiraSession = { auth: JiraAuth; role: "creative" | "requester"; email: string; name: string; accountId: string };

/**
 * Reads the signed-in user's Atlassian token from the encrypted session cookie.
 * Tokens never go to the browser; only server routes call this.
 */
export async function jiraSession(req: Request): Promise<JiraSession> {
  const secure = new URL(req.url).protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: secure,
    salt: `${secure ? "__Secure-" : ""}authjs.session-token`,
  });
  if (!token?.accessToken) throw new JiraError(401, "Not signed in.");
  if (token.error) throw new JiraError(401, "Your Atlassian session expired. Sign in again.");
  const cloudId = token.cloudId ?? (await findCloudId(token.accessToken));
  if (!cloudId) throw new JiraError(403, "Your Atlassian account can't reach the configured Jira site.");
  return {
    auth: { accessToken: token.accessToken, cloudId },
    role: token.role ?? "requester",
    email: String(token.email ?? ""),
    name: String(token.name ?? ""),
    accountId: token.accountId ?? "",
  };
}

/** JQL fragment limiting requesters to tickets they are on. Creatives see the whole project. */
export function visibilityClause(role: "creative" | "requester", withCc: boolean): string {
  if (role === "creative") return "";
  const parts = ["reporter = currentUser()", "assignee = currentUser()", "watcher = currentUser()"];
  if (withCc) parts.push("cf[10142] = currentUser()");
  return `(${parts.join(" OR ")})`;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof JiraError) {
    const status = e.status === 401 || e.status === 403 || e.status === 404 || e.status === 400 ? e.status : 502;
    return Response.json({ error: e.message }, { status });
  }
  return Response.json({ error: "Couldn't reach Jira." }, { status: 502 });
}
