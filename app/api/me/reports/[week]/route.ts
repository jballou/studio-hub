import { apiError } from "@/lib/google/http";
import { requireMe } from "@/lib/me/session";
import { assertWeekStart, deleteReport, getReport, saveReport } from "@/lib/store/me";

const headers = { "Cache-Control": "private, no-store" };

/** GET /api/me/reports/2026-11-09  One of my reports. 404 when there isn't one. */
export async function GET(req: Request, ctx: RouteContext<"/api/me/reports/[week]">) {
  try {
    const me = await requireMe(req);
    const { week } = await ctx.params;
    const report = await getReport(me, assertWeekStart(week));
    if (!report) return Response.json({ error: "No report for that week yet." }, { status: 404, headers });
    return Response.json({ report }, { headers });
  } catch (e) {
    return apiError(e);
  }
}

/** PUT { body?, status? }  Edit my report. status: "draft" | "final". */
export async function PUT(req: Request, ctx: RouteContext<"/api/me/reports/[week]">) {
  try {
    const me = await requireMe(req);
    const { week } = await ctx.params;
    const input = await req.json().catch(() => ({}));
    return Response.json({ report: await saveReport(me, assertWeekStart(week), { body: input.body, status: input.status }) }, { headers });
  } catch (e) {
    return apiError(e);
  }
}

/** DELETE  Remove my report for that week. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/me/reports/[week]">) {
  try {
    const me = await requireMe(req);
    const { week } = await ctx.params;
    await deleteReport(me, assertWeekStart(week));
    return Response.json({ ok: true }, { headers });
  } catch (e) {
    return apiError(e);
  }
}
