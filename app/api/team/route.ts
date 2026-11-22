import { searchUsers } from "@/lib/jira/client";
import { cached } from "@/lib/jira/cache";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { teamRoster } from "@/lib/store/users";

/**
 * GET: the creative team (people who can be assigned work). The Hub learns a Jira id at sign-in, but someone whose
 * session predates that tracking has none yet, so we look them up in Jira by work email instead of leaving them out.
 */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const roster = await teamRoster();
    const members = (
      await Promise.all(
        roster.map(async (m) => {
          if (m.id) return { id: m.id, name: m.name, email: m.email };
          try {
            const { value: id } = await cached(s.accountId, `team-id|${m.email}`, 6 * 3600_000, async () => {
              const hit = (await searchUsers(s.auth, m.email, 5)).find((u) => u.emailAddress?.toLowerCase() === m.email);
              return hit?.accountId ?? "";
            });
            return id ? { id, name: m.name, email: m.email } : null;
          } catch {
            return null;
          }
        }),
      )
    ).filter((m): m is { id: string; name: string; email: string } => !!m);
    return Response.json({ members });
  } catch (e) {
    return errorResponse(e);
  }
}
