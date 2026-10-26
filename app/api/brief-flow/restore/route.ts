import { restoreFlow } from "@/lib/store/flow";
import { AdminError } from "@/lib/store/users";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** POST { version }: publish an earlier version again (as a new version, so nothing is lost). */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can edit the questions.");
    const body = await req.json().catch(() => ({}));
    return Response.json({ flow: await restoreFlow(s.email, Number(body.version)) });
  } catch (e) {
    return errorResponse(e);
  }
}
