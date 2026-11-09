import { cached } from "@/lib/jira/cache";
import { jqlString, LIST_FIELDS, searchIssuesPaged } from "@/lib/jira/client";
import { PROJECT_KEY, toProject } from "@/lib/jira/map";
import { errorResponse, leadSession } from "@/lib/jira/session";
import { AdminError, teamMembers } from "@/lib/store/users";

const RECENT = "(statusCategory != Done OR resolutiondate >= -14d)";

/**
 * GET /api/team/work?person=<jira account id>|all  Team leads only.
 * The Jira work on one creative's My Day, or on everyone's together: open tickets plus anything closed in the last 14 days.
 * It is the same ticket data every creative can already see in Projects. Personal tasks, calendars, notes and reports are never part of it.
 */
export async function GET(req: Request) {
  try {
    const s = await leadSession(req);
    const person = new URL(req.url).searchParams.get("person") ?? "all";
    const members = await teamMembers();
    let ids: string[];
    if (person === "all") ids = members.map((m) => m.id);
    else {
      if (!members.some((m) => m.id === person)) throw new AdminError(404, "That person isn't on the creative team.");
      ids = [person];
    }
    if (!ids.length) return Response.json({ members, projects: [], stale: false });
    const { value: projects, stale } = await cached(s.accountId, `team-work|${person}`, 60_000, async () => {
      const who = ids.map(jqlString).join(", ");
      const issues = await searchIssuesPaged(s.auth, `project = ${PROJECT_KEY} AND assignee in (${who}) AND ${RECENT} ORDER BY duedate ASC, updated DESC`, LIST_FIELDS, 200);
      return issues.map(toProject);
    });
    return Response.json({ members, projects, stale }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
