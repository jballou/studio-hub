import { apiError } from "@/lib/google/http";
import { tasksForClient } from "@/lib/google/tasksSync";
import { jiraSession } from "@/lib/jira/session";
import { addTask } from "@/lib/store/tasks";

/** GET /api/tasks  My tasks. Also catches Google Tasks up on anything not backed up yet. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    return Response.json(await tasksForClient(s.email, true));
  } catch (e) {
    return apiError(e);
  }
}

/** POST { title, notes?, date?, time?, tz? }  Personal tasks are never written to Jira. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const task = await addTask(s.email, await req.json().catch(() => ({})));
    return Response.json({ ...(await tasksForClient(s.email, true)), id: task.id }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
