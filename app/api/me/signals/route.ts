import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { collectSignals } from "@/lib/me/collect";
import { requireMe } from "@/lib/me/session";
import { counts } from "@/lib/me/signals";
import { weekStartOf } from "@/lib/me/week";
import { AdminError } from "@/lib/store/users";

/**
 * GET /api/me/signals?week=YYYY-MM-DD  The signed-in person's own week: tickets, review comments, tasks, notes and meetings.
 * Only the week can be chosen. Whose week it is always comes from the session cookie, never from the request.
 */
export async function GET(req: Request) {
  try {
    const me = await requireMe(req);
    const session = await jiraSession(req);
    const raw = new URL(req.url).searchParams.get("week") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) throw new AdminError(400, "That week doesn't look right.");
    const signals = await collectSignals(me, session, weekStartOf(raw));
    return Response.json({ signals, counts: counts(signals) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
