import { cached } from "@/lib/jira/cache";
import { JiraError, searchIssues } from "@/lib/jira/client";
import { loadRelations } from "@/lib/jira/relations";
import { errorResponse, jiraSession, visibilityClause } from "@/lib/jira/session";

/** GET  Where this ticket sits (parents and children) and what it's linked to. Same visibility rules as the ticket itself. */
export async function GET(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/relations">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
    const s = await jiraSession(req);
    if (s.role === "requester") {
      const hit = await searchIssues(s.auth, `key = ${key} AND ${visibilityClause("requester", false)}`, ["summary"], 1);
      if (hit.length === 0) throw new JiraError(404, "Ticket not found.");
    }
    const { value: relations, stale } = await cached(s.accountId, `relations|${key}`, 60_000, () => loadRelations(s.auth, key));
    return Response.json({ relations, stale });
  } catch (e) {
    return errorResponse(e);
  }
}
