import { apiError } from "@/lib/google/http";
import { requireMe } from "@/lib/me/session";
import { listReports } from "@/lib/store/me";

/** GET /api/me/reports  The signed-in person's own weekly reports, newest first. Nobody else's, ever. */
export async function GET(req: Request) {
  try {
    const me = await requireMe(req);
    return Response.json({ reports: await listReports(me) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
