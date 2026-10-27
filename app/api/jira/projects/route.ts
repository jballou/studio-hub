import { cached } from "@/lib/jira/cache";
import { JiraError, jqlString, LIST_FIELDS, searchIssues } from "@/lib/jira/client";
import { PROJECT_KEY, toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession, visibilityClause } from "@/lib/jira/session";
import { closedClause, OPEN_CLAUSE } from "@/lib/settings";
import { getSettings } from "@/lib/store/settings";

/** GET /api/jira/projects?q=101&limit=8  Lists (or searches by key, number or title) tickets the user may see. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
    // scope=mine: creatives see what's assigned to them. Requesters aren't assigned work, so for them "mine" is everything they're on.
    const g = url.searchParams.get("group");
    const group = g === "open" || g === "closed" ? g : "all";
    const mineOnly = url.searchParams.get("scope") === "mine" && s.role === "creative";

    // Listing hides old closed work (an admin setting). Searching by key or title still finds everything.
    const { projectLookbackDays } = await getSettings();
    const build = (withCc: boolean) => {
      const parts = [`project = ${PROJECT_KEY}`];
      const vis = visibilityClause(s.role, withCc);
      if (vis) parts.push(vis);
      if (mineOnly) parts.push("assignee = currentUser()");
      // Open work loads first; closed work (inside the look-back window) only when asked for. Searching ignores both.
      if (!q && group === "open") parts.push(OPEN_CLAUSE);
      if (!q && group === "closed") parts.push(closedClause(projectLookbackDays));
      if (!q && group === "all") parts.push(`(${OPEN_CLAUSE} OR ${closedClause(projectLookbackDays)})`);
      if (q) {
        const key = /^mktgcrtv-\d+$/i.test(q) ? q.toUpperCase() : /^\d+$/.test(q) ? `${PROJECT_KEY}-${q}` : null;
        parts.push(`(${[key && `key = ${key}`, `summary ~ ${jqlString(`${q}*`)}`].filter(Boolean).join(" OR ")})`);
      }
      return `${parts.join(" AND ")} ORDER BY updated DESC`;
    };

    // Repeat loads inside 30 seconds come from memory; if Jira is rate-limiting, an older copy is shown rather than an error.
    const { value: projects, stale } = await cached(s.accountId, `list|${s.role}|${mineOnly}|${group}|${q}|${limit}|${projectLookbackDays}`, 60_000, async () => {
      let issues;
      try {
        issues = await searchIssues(s.auth, build(true), LIST_FIELDS, limit);
      } catch (e) {
        // The Cc field may not be searchable by JQL; retry without it rather than failing the page.
        if (!(e instanceof JiraError) || e.status !== 400) throw e;
        issues = await searchIssues(s.auth, build(false), LIST_FIELDS, limit);
      }
      return issues.map(toProject);
    });
    return Response.json({ projects, stale });
  } catch (e) {
    return errorResponse(e);
  }
}
