import { invalidateUser } from "@/lib/jira/cache";
import { assignIssue } from "@/lib/jira/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { AdminError, audit } from "@/lib/store/users";

/** POST { accountId: string | null }  Assigns the ticket (or unassigns it). Creative team only. */
export async function POST(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/assignee">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can assign tickets.");
    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId === null ? null : String(body.accountId ?? "");
    if (accountId === "") throw new AdminError(400, "Choose who to assign it to.");
    await assignIssue(s.auth, key, accountId);
    invalidateUser(s.accountId);
    await audit({ actor: s.email, action: "ticket.assign", target: key, detail: accountId ?? "nobody" });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
