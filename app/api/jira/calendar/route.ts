import { ISSUE_FIELDS, JiraError, searchIssues } from "@/lib/jira/client";
import { toCalendarItem } from "@/lib/jira/map";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET /api/jira/calendar?jql=...&dateField=duedate  Calendar items from a JQL query, run as the signed-in user. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const p = new URL(req.url).searchParams;
    const jql = (p.get("jql") ?? "").trim();
    const dateField = p.get("dateField") ?? "duedate";
    if (!jql || jql.length > 1000) throw new JiraError(400, "Provide a JQL query.");
    if (!/^(duedate|customfield_\d+)$/.test(dateField)) throw new JiraError(400, "Unsupported date field.");
    const source = { id: p.get("sourceId") ?? "jira", name: p.get("sourceName") ?? "Jira" };
    const issues = await searchIssues(s.auth, jql, [...new Set([...ISSUE_FIELDS, dateField])], 100);
    const items = issues.map((i) => toCalendarItem(i, dateField, source)).filter((i) => i !== null);
    return Response.json({ items, skipped: issues.length - items.length });
  } catch (e) {
    return errorResponse(e);
  }
}
