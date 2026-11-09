import { errorResponse, jiraSession } from "@/lib/jira/session";
import { blocksHeldBy } from "@/lib/store/blocks";

export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    // How many tickets are waiting on this person (drives the bell and the "Waiting on you" badge).
    const blockingCount = await blocksHeldBy(s.accountId).then((b) => b.length).catch(() => 0);
    return Response.json({ name: s.name, email: s.email, role: s.role, isAdmin: s.isAdmin, isLead: s.isLead, accountId: s.accountId, blockingCount });
  } catch (e) {
    return errorResponse(e);
  }
}
