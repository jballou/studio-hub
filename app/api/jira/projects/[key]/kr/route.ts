import { invalidateUser } from "@/lib/jira/cache";
import { getIssue, setKrLabel } from "@/lib/jira/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { NO_KR_LABEL } from "@/lib/okr/label";
import { getOkrMirror } from "@/lib/store/okr";
import { AdminError } from "@/lib/store/users";

/** POST { kr: "kr-xxxxxxxx" | "none" }  Tags the ticket with the KR its work supports. Creative team only. */
export async function POST(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/kr">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can change a project's KR.");
    const body = await req.json().catch(() => ({}));
    const kr = String(body.kr ?? "");
    let label = NO_KR_LABEL;
    if (kr !== "none") {
      const known = (await getOkrMirror())?.krs.some((k) => k.id === kr);
      if (!known) throw new AdminError(400, "That KR isn't in the synced OKR list.");
      label = kr;
    }
    const issue = await getIssue(s.auth, key);
    await setKrLabel(s.auth, key, label, issue.fields.labels ?? []);
    invalidateUser(s.accountId);
    return Response.json({ ok: true, kr: label === NO_KR_LABEL ? "none" : label });
  } catch (e) {
    return errorResponse(e);
  }
}
