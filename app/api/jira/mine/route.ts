import { searchIssues } from "@/lib/jira/client";
import { PROJECT_KEY, toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET /api/jira/mine  My open tickets, soonest deadline first, plus ones I closed in the last 14 days (for completion and on-time numbers). */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const issues = await searchIssues(s.auth, `project = ${PROJECT_KEY} AND assignee = currentUser() AND (statusCategory != Done OR resolutiondate >= -14d) ORDER BY duedate ASC, updated DESC`, undefined, 60);
    return Response.json({ projects: issues.map(toProject) });
  } catch (e) {
    return errorResponse(e);
  }
}
