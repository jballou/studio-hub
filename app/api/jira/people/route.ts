import { searchUsers } from "@/lib/jira/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET /api/jira/people?q=ali  People picker search. Returns just what the UI needs: id, name, email when Jira shows it. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const people = (await searchUsers(s.auth, q, 8)).map((u) => ({ id: u.accountId, name: u.displayName, email: u.emailAddress }));
    return Response.json({ people });
  } catch (e) {
    return errorResponse(e);
  }
}
