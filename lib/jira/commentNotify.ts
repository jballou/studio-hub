import { recentIssueComments, searchIssues } from "./client";
import { PROJECT_KEY } from "./map";
import type { JiraSession } from "./session";
import { visibilityClause } from "./session";
import { claimCommentCheck, finishCommentCheck, notify } from "@/lib/store/notifications";

/**
 * Turns new Jira comments on tickets I'm on into bell notifications. Runs from the bell's own poll, at most every 2 minutes
 * per person, so it needs no webhook. Several comments on one ticket fold into one line. My own comments are skipped, and
 * requesters never hear about internal notes.
 */
export async function syncCommentNotifications(s: JiraSession): Promise<void> {
  const claim = await claimCommentCheck(s.accountId);
  if (!claim) return;
  const startedAt = new Date().toISOString();
  try {
    // Relative minutes keep this free of time-zone guesses; capped at a week.
    const minutes = Math.min(10_080, Math.ceil((Date.now() - +new Date(claim.since)) / 60_000) + 1);
    const vis = visibilityClause(s.role, false);
    const mine = "(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser())";
    const jql = `project = ${PROJECT_KEY} AND ${mine}${vis ? ` AND ${vis}` : ""} AND updated >= -${minutes}m ORDER BY updated DESC`;
    const issues = await searchIssues(s.auth, jql, ["summary"], 10);
    for (const issue of issues) {
      const fresh = (await recentIssueComments(s.auth, issue.key)).filter((c) =>
        c.created > claim.since && c.author?.accountId !== s.accountId && (s.role !== "requester" || c.jsdPublic !== false));
      if (fresh.length === 0) continue;
      await notify([s.accountId], {
        kind: "jira-comment", key: `jira-comment:${issue.key}`, assetId: "", assetName: issue.fields.summary,
        projectKey: issue.key, fromName: fresh[0].author?.displayName ?? "Someone", count: fresh.length,
      });
    }
    await finishCommentCheck(s.accountId, startedAt);
  } catch {
    // Jira busy or unreachable: leave the cursor where it was, so these comments are found on the next try.
  }
}
