import { readAudit } from "@/lib/store/users";
import { adminSession, errorResponse } from "@/lib/jira/session";

/** GET /api/admin/audit?limit=200: the change history, newest first. */
export async function GET(req: Request) {
  try {
    await adminSession(req);
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 100, 1), 500);
    return Response.json({ entries: await readAudit(limit) });
  } catch (e) {
    return errorResponse(e);
  }
}
