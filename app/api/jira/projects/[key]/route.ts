import { JiraError, getIssue, searchIssues } from "@/lib/jira/client";
import { toProjectDetail } from "@/lib/jira/map";
import { errorResponse, jiraSession, visibilityClause } from "@/lib/jira/session";
import { blocksHeldBy } from "@/lib/store/blocks";

export async function GET(req: Request, ctx: RouteContext<"/api/jira/projects/[key]">) {
  try {
    const { key } = await ctx.params;
    if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
    const s = await jiraSession(req);
    // Someone a ticket is blocked on may not be on it in Jira, but they must be able to open it to unblock it.
    const holdsBlock = s.role === "requester" && (await blocksHeldBy(s.accountId).catch(() => [])).some((b) => b.key === key);
    if (s.role === "requester" && !holdsBlock) {
      // Requesters only see tickets they are on; a ticket outside that looks the same as one that doesn't exist.
      const vis = visibilityClause("requester", false);
      const hit = await searchIssues(s.auth, `key = ${key} AND ${vis}`, undefined, 1);
      if (hit.length === 0) throw new JiraError(404, "Ticket not found.");
      return Response.json({ project: toProjectDetail(hit[0]) });
    }
    return Response.json({ project: toProjectDetail(await getIssue(s.auth, key)) });
  } catch (e) {
    return errorResponse(e);
  }
}
