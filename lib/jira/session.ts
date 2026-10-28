import { getToken } from "next-auth/jwt";
import { AdminError, resolveAccess, visibilityRole } from "@/lib/store/users";
import { findCloudId, JiraError, type JiraAuth } from "./client";

export type JiraSession = {
  auth: JiraAuth;
  /** What the person can see: "creative" (also admins) sees every ticket, "requester" only their own. */
  role: "creative" | "requester";
  isAdmin: boolean;
  email: string;
  name: string;
  accountId: string;
};

/**
 * Reads the signed-in user's Atlassian token from the encrypted session cookie, then looks up their
 * current role and status. Disabled people are refused here, so removing access takes effect on the next request.
 * Tokens never go to the browser; only server routes call this.
 */
// If sign-in couldn't work out the site id, don't ask Atlassian again on every request.
const cloudMemo = new Map<string, { id: string | undefined; at: number }>();
async function cloudFor(accessToken: string): Promise<string | undefined> {
  const hit = cloudMemo.get(accessToken);
  if (hit && Date.now() - hit.at < 300_000) return hit.id;
  const id = await findCloudId(accessToken);
  cloudMemo.set(accessToken, { id, at: Date.now() });
  if (cloudMemo.size > 200) cloudMemo.delete(cloudMemo.keys().next().value as string);
  return id;
}

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
  const email = String(token.email ?? "");
  const access = await resolveAccess(email);
  if (!access.active) throw new JiraError(403, "Your access has been removed. Ask a Brand Creative admin.");
  const cloudId = token.cloudId ?? (await cloudFor(token.accessToken));
  if (!cloudId) throw new JiraError(403, "Your Atlassian account can't reach the configured Jira site.");
  return {
    auth: { accessToken: token.accessToken, cloudId },
    role: visibilityRole(access.role),
    isAdmin: access.role === "admin",
    email,
    name: String(token.name ?? ""),
    accountId: token.accountId ?? "",
  };
}

/** For admin-only routes. */
export async function adminSession(req: Request): Promise<JiraSession> {
  const s = await jiraSession(req);
  if (!s.isAdmin) throw new AdminError(403, "Admins only.");
  return s;
}

/** JQL fragment limiting requesters to tickets they are on. Creatives see the whole project. */
export function visibilityClause(role: "creative" | "requester", withCc: boolean): string {
  if (role === "creative") return "";
  const parts = ["reporter = currentUser()", "assignee = currentUser()", "watcher = currentUser()"];
  if (withCc) parts.push("cf[10142] = currentUser()");
  return `(${parts.join(" OR ")})`;
}

export function errorResponse(e: unknown): Response {
  // Next signals "this route needs a real request" by throwing; that must reach Next, not become an error response.
  if (e && typeof e === "object" && ("digest" in e && String((e as { digest?: unknown }).digest).startsWith("DYNAMIC_SERVER_USAGE") || /bail out of prerendering/i.test(String((e as { message?: unknown }).message)))) throw e;
  if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof JiraError && e.status === 429) {
    // Say what happened and how long to wait, so the page can retry on its own.
    const wait = e.retryAfter ?? 30;
    return Response.json(
      { error: "Jira is busy right now. Give it a minute and try again.", code: "rate-limited", retryAfter: wait, reason: e.reason },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }
  if (e instanceof JiraError) {
    const status = e.status === 401 || e.status === 403 || e.status === 404 || e.status === 400 ? e.status : 502;
    return Response.json({ error: e.message }, { status });
  }
  // Not a Jira answer at all: a bug or a storage hiccup on our side. Say so, and keep the detail in the server log.
  console.error("[api] unexpected error", e);
  return Response.json({ error: "Something went wrong on our side. Try again, and tell the Brand Creative team if it keeps happening." }, { status: 500 });
}
