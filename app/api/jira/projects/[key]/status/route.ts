import { COLUMNS } from "@/lib/board";
import { getIssue, JiraError, transitionToStatus } from "@/lib/jira/client";
import { jiraSyncFailure } from "@/lib/jira/sync";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { activeBlocks } from "@/lib/store/blocks";
import { AdminError } from "@/lib/store/users";

const ALLOWED = new Set(COLUMNS.map((c) => c.jiraStatus));

/**
 * POST { status }  Moves a ticket to one of the board's statuses (Open, In Progress, In Review, Done).
 * Creative team only. Blocked tickets go through "Mark as unblocked" instead, so the block record stays honest.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/status">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can change a ticket's status.");
    const body = await req.json().catch(() => ({}));
    const status = String(body.status ?? "");
    if (!ALLOWED.has(status)) throw new JiraError(400, "That isn't a status the board can set.");

    const issue = await getIssue(s.auth, key);
    if (issue.fields.status.name.toLowerCase() === "blocked" || (await activeBlocks([key])).length > 0) {
      throw new AdminError(409, "This ticket is blocked. Open it and use “Mark as unblocked” to choose its next status.");
    }
    try {
      const r = await transitionToStatus(s.auth, key, status);
      if (r === "no-transition") return Response.json({ ok: false, reason: `Jira's workflow doesn't allow moving this ticket to ${status} from ${issue.fields.status.name}.` }, { status: 409 });
      return Response.json({ ok: true, status });
    } catch (e) {
      return Response.json(jiraSyncFailure(e), { status: 409 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
