import { searchIssues } from "@/lib/jira/client";
import { PROJECT_KEY, toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET /api/jira/mine  Open tickets assigned to me, soonest deadline first (tickets with no deadline last). */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const issues = await searchIssues(s.auth, `project = ${PROJECT_KEY} AND assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC, updated DESC`, undefined, 50);
    return Response.json({ projects: issues.map(toProject) });
  } catch (e) {
    return errorResponse(e);
  }
}
