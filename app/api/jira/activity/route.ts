import { cached } from "@/lib/jira/cache";
import { searchWithChangelog } from "@/lib/jira/client";
import { PROJECT_KEY } from "@/lib/jira/map";
import { errorResponse, jiraSession, visibilityClause } from "@/lib/jira/session";

type History = { id: string; created: string; author?: { displayName?: string; accountId?: string }; items: { field: string; fromString?: string | null; toString?: string | null }[] };

const FIELD_WORDS: Record<string, string> = { duedate: "the due date", assignee: "the assignee", summary: "the title", description: "the description", priority: "the priority" };

/** One plain sentence for a Jira change. Only fields people care about are named; the rest are "updated". */
function sentence(h: History): string {
  const status = h.items.find((i) => i.field === "status");
  if (status) return `moved to ${status.toString}`;
  const first = h.items[0];
  if (!first) return "updated";
  if (first.field === "assignee") return first.toString ? `assigned to ${first.toString}` : "unassigned";
  return `changed ${FIELD_WORDS[first.field] ?? first.field.toLowerCase()}`;
}

/**
 * GET /api/jira/activity  The latest change on each of the 5 most recently updated tickets I'm on (change history is costly, so it's capped and cached).
 * Runs as the signed-in user, so Jira only returns tickets they can see.
 */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const mine = "(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser())";
    const vis = visibilityClause(s.role, false);
    const jql = `project = ${PROJECT_KEY} AND ${mine}${vis ? ` AND ${vis}` : ""} ORDER BY updated DESC`;
    const { value: items, stale } = await cached(s.accountId, "activity", 180_000, async () => {
      const issues = await searchWithChangelog(s.auth, jql, 5);
      const items = issues.flatMap((i) => {
        const latest = [...(i.changelog?.histories ?? [])].sort((a, b) => b.created.localeCompare(a.created))[0];
        if (!latest) return [];
        return [{
          id: `${i.key}-${latest.id}`,
          key: i.key,
          title: i.fields.summary,
          who: latest.author?.displayName ?? "Someone",
          mine: !!latest.author?.accountId && latest.author.accountId === s.accountId,
          what: sentence(latest),
          at: latest.created,
        }];
      });
      return items;
    });
    return Response.json({ items, stale });
  } catch (e) {
    return errorResponse(e);
  }
}
