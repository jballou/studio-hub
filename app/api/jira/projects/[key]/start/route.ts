import { getIssue, JiraError, setStartDate } from "@/lib/jira/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { startDateProblem } from "@/lib/startdate";
import { AdminError } from "@/lib/store/users";

/** POST { date: "YYYY-MM-DD" }  Plans the work: sets the ticket's Jira Start date. Creative team only. */
export async function POST(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/start">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can plan work.");
    const body = await req.json().catch(() => ({}));
    const date = String(body.date ?? "");
    const issue = await getIssue(s.auth, key);
    const problem = startDateProblem(date, issue.fields.duedate ?? "");
    if (problem) throw new JiraError(400, problem);
    await setStartDate(s.auth, key, date);
    return Response.json({ ok: true, date });
  } catch (e) {
    return errorResponse(e);
  }
}
