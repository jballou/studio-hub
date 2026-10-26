import { apiError } from "@/lib/google/http";
import { tasksForClient } from "@/lib/google/tasksSync";
import { jiraSession } from "@/lib/jira/session";
import { patchTask, removeTask } from "@/lib/store/tasks";

/** PATCH { title?, notes?, date?, time?, tz?, done? } */
export async function PATCH(req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const { id } = await ctx.params;
    const s = await jiraSession(req);
    await patchTask(s.email, id, await req.json().catch(() => ({})));
    return Response.json(await tasksForClient(s.email, true));
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const { id } = await ctx.params;
    const s = await jiraSession(req);
    await removeTask(s.email, id);
    return Response.json(await tasksForClient(s.email, true));
  } catch (e) {
    return apiError(e);
  }
}
