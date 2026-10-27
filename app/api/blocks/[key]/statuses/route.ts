import { listTargetStatuses } from "@/lib/jira/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET  The statuses this ticket can move to now, for the "Mark as unblocked" picker. "Blocked" itself is left out. */
export async function GET(req: Request, ctx: RouteContext<"/api/blocks/[key]/statuses">) {
  try {
    const { key } = await ctx.params;
    const s = await jiraSession(req);
    const all = await listTargetStatuses(s.auth, decodeURIComponent(key).toUpperCase());
    return Response.json({ statuses: all.filter((x) => x.name.toLowerCase() !== "blocked") });
  } catch (e) {
    return errorResponse(e);
  }
}
