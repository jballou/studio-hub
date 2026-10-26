import { JiraError } from "./client";
import type { JiraSync } from "@/lib/types";

/** Turns a failed Jira write into a plain message. 401/403 usually means the sign-in predates the write scope. */
export function jiraSyncFailure(e: unknown): Extract<JiraSync, { ok: false }> {
  if (e instanceof JiraError && (e.status === 401 || e.status === 403)) {
    return { ok: false, reason: "Jira wouldn't let this account change the status. Sign out and back in to allow it, or ask a Jira admin if it keeps happening." };
  }
  if (e instanceof JiraError && e.status === 404) return { ok: false, reason: "Jira couldn't find that ticket." };
  return { ok: false, reason: "Couldn't reach Jira to update the status." };
}
