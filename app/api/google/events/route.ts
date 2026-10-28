import { listEvents } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { cached } from "@/lib/jira/cache";
import { jiraSession } from "@/lib/jira/session";

/** GET /api/google/events?from=ISO&to=ISO  The signed-in person's own calendar events, at most 14 days at a time. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const p = new URL(req.url).searchParams;
    const from = new Date(p.get("from") ?? ""), to = new Date(p.get("to") ?? "");
    if (isNaN(+from) || isNaN(+to) || to <= from || +to - +from > 14 * 864e5) return Response.json({ error: "Choose a date range of up to 14 days." }, { status: 400 });
    // The same day is asked for on every My Day visit and retry; Google is asked once a minute, not once per page load.
    const { value } = await cached(s.accountId, `gcal|${from.toISOString()}|${to.toISOString()}`, 60_000, () => listEvents(s.email, from.toISOString(), to.toISOString()));
    return Response.json({ events: value });
  } catch (e) {
    return apiError(e);
  }
}
