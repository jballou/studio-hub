import { cached } from "@/lib/jira/cache";
import { LIST_FIELDS, searchIssuesPaged } from "@/lib/jira/client";
import { PROJECT_KEY, toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { AdminError } from "@/lib/store/users";

const RANGES = [90, 180, 365];

/** GET /api/jira/analytics?range=180  Tickets resolved in the last N days (up to 500), for the Analytics page. Creative team only. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Analytics is for the creative team.");
    const asked = Number(new URL(req.url).searchParams.get("range"));
    const range = RANGES.includes(asked) ? asked : 180;
    const { value, stale } = await cached(s.accountId, `analytics|${range}`, 10 * 60_000, async () => {
      const issues = await searchIssuesPaged(s.auth, `project = ${PROJECT_KEY} AND statusCategory = Done AND resolutiondate >= -${range}d ORDER BY resolutiondate DESC`, LIST_FIELDS, 500);
      return { projects: issues.map(toProject), truncated: issues.length >= 500 };
    });
    return Response.json({ ...value, range, stale });
  } catch (e) {
    return errorResponse(e);
  }
}
