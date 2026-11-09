import { errorResponse, jiraSession } from "@/lib/jira/session";
import { teamMembers } from "@/lib/store/users";

/** GET: the creative team (people who can be assigned work). Only people who have signed in once have an id to assign to. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const members = await teamMembers();
    return Response.json({ members });
  } catch (e) {
    return errorResponse(e);
  }
}
