import { invalidateUser } from "@/lib/jira/cache";
import { getIssue, JiraError, setDueDate } from "@/lib/jira/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { startDateProblem } from "@/lib/startdate";
import { AdminError } from "@/lib/store/users";

/** POST { date: "YYYY-MM-DD" }  Changes the ticket's Jira due date. Creative team only. */
export async function POST(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/due">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can change due dates.");
    const body = await req.json().catch(() => ({}));
    const date = String(body.date ?? "");
    const issue = await getIssue(s.auth, key);
    const start = issue.fields.startDate ?? "";
    const problem = start ? startDateProblem(start, date) : null;
    if (problem) throw new JiraError(400, "The due date can't be before the start date.");
    await setDueDate(s.auth, key, date);
    invalidateUser(s.accountId);
    return Response.json({ ok: true, date });
  } catch (e) {
    return errorResponse(e);
  }
}
