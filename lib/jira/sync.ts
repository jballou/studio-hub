import { JiraError, tokenScopes, type JiraAuth } from "./client";
import type { JiraSync } from "@/lib/types";

/**
 * Turns a failed Jira write into a plain message. For 401/403 it checks the sign-in token itself, so the person is told
 * the real cause: the sign-in predates the write permission (sign out and in), or Jira's own permissions say no.
 */
export async function jiraSyncFailure(e: unknown, auth?: JiraAuth): Promise<Extract<JiraSync, { ok: false }>> {
  if (e instanceof JiraError && (e.status === 401 || e.status === 403)) {
    const scopes = auth ? await tokenScopes(auth) : null;
    if (scopes && !scopes.includes("write:jira-work")) {
      return { ok: false, reason: "Your sign-in doesn't include permission to change tickets yet. Sign out and sign back in (you'll see one new Atlassian consent screen), then try again." };
    }
    if (scopes) {
      return { ok: false, reason: `Jira says your account can't change this ticket's status${e.message ? ` (“${e.message}”)` : ""}. That's a Jira permission (Transition issues) or a workflow rule; ask a Jira admin.` };
    }
    return { ok: false, reason: `Jira wouldn't let this account change the status${e.message ? ` (“${e.message}”)` : ""}. Sign out and back in, or ask a Jira admin if it keeps happening.` };
  }
  if (e instanceof JiraError && e.status === 404) return { ok: false, reason: "Jira couldn't find that ticket." };
  if (e instanceof JiraError && e.status === 400) return { ok: false, reason: e.message || "Jira didn't accept that change." };
  return { ok: false, reason: "Couldn't reach Jira to update the status." };
}
