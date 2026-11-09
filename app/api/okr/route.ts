import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { getOkrMirror } from "@/lib/store/okr";

/** GET /api/okr  Read-only KRs and initiatives for pickers and chips. Company goals only; nothing personal. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const m = await getOkrMirror();
    return Response.json(m ? { syncedAt: m.syncedAt, krs: m.krs, initiatives: m.initiatives } : { syncedAt: null, krs: [], initiatives: [] });
  } catch (e) {
    return apiError(e);
  }
}
