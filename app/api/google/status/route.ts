import { configured } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { getConnection } from "@/lib/store/google";

/** GET /api/google/status  { configured, connected, googleEmail?, broken? } */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const c = configured() ? await getConnection(s.email) : null;
    return Response.json({ configured: configured(), connected: !!c, googleEmail: c?.googleEmail, broken: !!c?.broken });
  } catch (e) {
    return apiError(e);
  }
}
