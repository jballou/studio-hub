import { cached } from "@/lib/jira/cache";
import { loadIntake } from "@/lib/jira/intake";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { AdminError } from "@/lib/store/users";

/** GET /api/jira/intake  Open tickets nobody owns yet (not Backlog or On Hold), oldest first. Creative team only. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Intake is for the creative team.");
    const { value: projects, stale } = await cached(s.accountId, "intake", 30_000, () => loadIntake(s.auth));
    return Response.json({ projects, stale });
  } catch (e) {
    return errorResponse(e);
  }
}
