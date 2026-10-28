import { errorResponse, jiraSession } from "@/lib/jira/session";
import { listUsers } from "@/lib/store/users";

/** GET: the creative team (people who can be assigned work). Only people who have signed in once have an id to assign to. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const users = await listUsers();
    const members = users
      .filter((u) => u.status === "active" && (u.role === "creative" || u.role === "admin") && u.accountId)
      .map((u) => ({ id: u.accountId!, name: u.name || u.email, email: u.email }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ members });
  } catch (e) {
    return errorResponse(e);
  }
}
