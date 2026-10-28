import { searchUsers } from "@/lib/jira/client";
import { cached } from "@/lib/jira/cache";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET /api/jira/people?q=ali  People picker search. Returns just what the UI needs: id, name, email when Jira shows it. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const q = new URL(req.url).searchParams.get("q") ?? "";
    // Typing the same name again (or backspacing) shouldn't search Jira again.
    const { value: people } = await cached(s.accountId, `people|${q.trim().toLowerCase()}`, 60_000, async () => (await searchUsers(s.auth, q, 8)).map((u) => ({ id: u.accountId, name: u.displayName, email: u.emailAddress })));
    return Response.json({ people });
  } catch (e) {
    return errorResponse(e);
  }
}
