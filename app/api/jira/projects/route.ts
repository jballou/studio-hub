import { JiraError, jqlString, searchIssues } from "@/lib/jira/client";
import { PROJECT_KEY, toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession, visibilityClause } from "@/lib/jira/session";

/** GET /api/jira/projects?q=101&limit=8  Lists (or searches by key, number or title) tickets the user may see. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);

    const build = (withCc: boolean) => {
      const parts = [`project = ${PROJECT_KEY}`];
      const vis = visibilityClause(s.role, withCc);
      if (vis) parts.push(vis);
      if (q) {
        const key = /^mktgcrtv-\d+$/i.test(q) ? q.toUpperCase() : /^\d+$/.test(q) ? `${PROJECT_KEY}-${q}` : null;
        parts.push(`(${[key && `key = ${key}`, `summary ~ ${jqlString(`${q}*`)}`].filter(Boolean).join(" OR ")})`);
      }
      return `${parts.join(" AND ")} ORDER BY updated DESC`;
    };

    let issues;
    try {
      issues = await searchIssues(s.auth, build(true), undefined, limit);
    } catch (e) {
      // The Cc field may not be searchable by JQL; retry without it rather than failing the page.
      if (!(e instanceof JiraError) || e.status !== 400) throw e;
      issues = await searchIssues(s.auth, build(false), undefined, limit);
    }
    return Response.json({ projects: issues.map(toProject) });
  } catch (e) {
    return errorResponse(e);
  }
}
