import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { collectSignals } from "@/lib/me/collect";
import { generateReport } from "@/lib/me/reportAgent";
import { requireMe } from "@/lib/me/session";
import { weekStartOf } from "@/lib/me/week";
import { assertWeekStart, getReport, saveReport } from "@/lib/store/me";
import { getOkrMirror } from "@/lib/store/okr";
import { AdminError } from "@/lib/store/users";

/**
 * POST { overwrite?: boolean }  Drafts my report for that week from my own Jira work, review comments, tasks, notes (including
 * interview answers) and calendar. Saves it as a draft that only I can read. Refuses to replace an existing report unless
 * overwrite is true, and never replaces one I marked final.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/me/reports/[week]/generate">) {
  try {
    const me = await requireMe(req);
    const session = await jiraSession(req);
    const { week } = await ctx.params;
    const weekStart = assertWeekStart(week);
    const body = await req.json().catch(() => ({}));

    const existing = await getReport(me, weekStart);
    if (existing?.status === "final") throw new AdminError(409, "That report is marked final. Reopen it as a draft before regenerating.");
    if (existing && body.overwrite !== true) throw new AdminError(409, "There's already a report for that week. Regenerating replaces it.");

    const [signals, okr, prev] = await Promise.all([
      collectSignals(me, session, weekStart),
      getOkrMirror().catch(() => null),
      getReport(me, weekStartOf(new Date(Date.parse(`${weekStart}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10))),
    ]);
    const krs = (okr?.krs ?? []).map((k) => ({ id: k.id, kr: k.kr, objective: k.objective, baseline: k.baseline, current: k.current, target: k.target }));
    const { body: draft, usedModel } = await generateReport(signals, krs, { sample: !!okr?.sample, prev: prev ? { nextSteps: prev.body.nextSteps } : null, openAhead: signals.openAhead });
    const report = await saveReport(me, weekStart, { body: draft, status: "draft" });
    return Response.json({ report, usedModel, sources: signals.sources }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
