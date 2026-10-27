import { activeBlocks, resolveBlock } from "@/lib/store/blocks";
import { transitionToStatus } from "@/lib/jira/client";
import { jiraSyncFailure } from "@/lib/jira/sync";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { AdminError } from "@/lib/store/users";
import type { JiraSync } from "@/lib/types";

/**
 * POST { note?, status? }  Marks a ticket unblocked. Allowed for the person it's blocked by, the creative team and admins.
 * `status` is the Jira status to move the ticket to; without it the ticket goes back to where it was.
 * A ticket that is Blocked in Jira with nobody named has no block record, so only the creative team can move it.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/blocks/[key]/resolve">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    const s = await jiraSession(req);
    const body = await req.json().catch(() => ({}));
    const status = String(body.status ?? "").trim().slice(0, 80);

    const hasRecord = (await activeBlocks([key])).length > 0;
    let block = null;
    if (hasRecord) {
      block = await resolveBlock({ email: s.email, accountId: s.accountId, canManage: s.role === "creative" }, key, String(body.note ?? ""));
    } else {
      if (s.role !== "creative") throw new AdminError(403, "Only the creative team can unblock this.");
      if (!status) throw new AdminError(400, "Choose a status to move it to.");
    }

    // Runs as whoever cleared it. If Jira refuses, the block is still cleared here and the message says why.
    const to = status || block?.previousStatus || "In Progress";
    let jira: JiraSync;
    try {
      const r = await transitionToStatus(s.auth, key, to);
      jira = r === "no-transition" ? { ok: false, reason: `Jira's workflow doesn't allow moving this ticket to ${to}.` } : { ok: true, changed: r === "moved", status: to };
    } catch (e) {
      jira = jiraSyncFailure(e);
    }
    return Response.json({ block, jira });
  } catch (e) {
    return errorResponse(e);
  }
}
