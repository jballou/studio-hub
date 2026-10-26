import type { Flow } from "@/lib/brief/flow";
import { readFlow, saveFlow } from "@/lib/store/flow";
import { AdminError } from "@/lib/store/users";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET: the questions the wizard asks (any signed-in person), plus version history for the editor. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    return Response.json(await readFlow());
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT { flow, baseVersion }: publish an edited flow. Creative team and admins. */
export async function PUT(req: Request) {
  try {
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can edit the questions.");
    const body = await req.json().catch(() => ({}));
    if (!body.flow || !Array.isArray(body.flow.nodes) || typeof body.flow.start !== "string") throw new AdminError(400, "That doesn't look like a question flow.");
    if (body.flow.nodes.length > 200) throw new AdminError(400, "That's too many questions (200 max).");
    const flow = await saveFlow(s.email, body.flow as Flow, Number(body.baseVersion));
    return Response.json({ flow });
  } catch (e) {
    return errorResponse(e);
  }
}
