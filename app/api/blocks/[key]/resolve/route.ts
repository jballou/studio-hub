import { resolveBlock } from "@/lib/store/blocks";
import { transitionToStatus } from "@/lib/jira/client";
import { jiraSyncFailure } from "@/lib/jira/sync";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import type { JiraSync } from "@/lib/types";

/** POST { note? }  Clears a block. Allowed for the person it's blocked by, the creative team and admins. */
export async function POST(req: Request, ctx: RouteContext<"/api/blocks/[key]/resolve">) {
  try {
    const { key } = await ctx.params;
    const s = await jiraSession(req);
    const body = await req.json().catch(() => ({}));
    const block = await resolveBlock(
      { email: s.email, accountId: s.accountId, canManage: s.role === "creative" },
      decodeURIComponent(key),
      String(body.note ?? ""),
    );
    // Put the ticket back where it was (In Progress if we never learned that). Runs as whoever cleared it.
    let jira: JiraSync;
    try {
      const back = block.previousStatus || "In Progress";
      const r = await transitionToStatus(s.auth, block.key, back);
      jira = r === "no-transition" ? { ok: false, reason: `Jira's workflow doesn't allow moving this ticket back to ${back}.` } : { ok: true, changed: r === "moved", status: back };
    } catch (e) {
      jira = jiraSyncFailure(e);
    }
    return Response.json({ block, jira });
  } catch (e) {
    return errorResponse(e);
  }
}
