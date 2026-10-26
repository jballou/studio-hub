import { resetFlow } from "@/lib/store/flow";
import { adminSession, errorResponse } from "@/lib/jira/session";

/** POST: go back to the built-in questions. Admins only. Previous versions stay in history. */
export async function POST(req: Request) {
  try {
    const s = await adminSession(req);
    return Response.json({ flow: await resetFlow(s.email) });
  } catch (e) {
    return errorResponse(e);
  }
}
