import { cached } from "@/lib/jira/cache";
import { JiraError, listIssueComments, searchIssues } from "@/lib/jira/client";
import { errorResponse, jiraSession, visibilityClause } from "@/lib/jira/session";
import type { JiraComment } from "@/lib/types";

/** GET  The ticket's Jira comments, oldest first. Same visibility rules as the ticket; requesters never get internal notes. */
export async function GET(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/comments">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
    const s = await jiraSession(req);
    if (s.role === "requester") {
      const hit = await searchIssues(s.auth, `key = ${key} AND ${visibilityClause("requester", false)}`, ["summary"], 1);
      if (hit.length === 0) throw new JiraError(404, "Ticket not found.");
    }
    const { value: all, stale } = await cached(s.accountId, `comments|${key}|${s.role}`, 60_000, async (): Promise<JiraComment[]> =>
      (await listIssueComments(s.auth, key))
        .filter((c) => s.role !== "requester" || c.jsdPublic !== false)
        .map((c) => ({ id: c.id, authorName: c.author?.displayName ?? "Someone", authorId: c.author?.accountId, created: c.created, updated: c.updated, bodyAdf: c.body })));
    return Response.json({ comments: all, stale });
  } catch (e) {
    return errorResponse(e);
  }
}
