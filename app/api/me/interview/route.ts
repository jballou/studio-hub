import { apiError } from "@/lib/google/http";
import { cached } from "@/lib/jira/cache";
import { jiraSession } from "@/lib/jira/session";
import { collectSignals } from "@/lib/me/collect";
import { findGaps, MAX_QUESTIONS, type Turn } from "@/lib/me/interview";
import { askNext } from "@/lib/me/interviewAgent";
import { requireMe } from "@/lib/me/session";
import { counts } from "@/lib/me/signals";
import { weekStartOf, weekWindow } from "@/lib/me/week";
import { addNote } from "@/lib/store/me";
import { AdminError } from "@/lib/store/users";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 160)).slice(0, max) : []);

/**
 * POST { week, asked: string[], history: {gapId, answer}[], answer?: {gapId, text} }
 *
 * One turn of the weekly interview. The page keeps the conversation; this saves the answer to the previous question (if any)
 * as a private note, then returns the next question, or `next: null` when the interview is finished. `text: ""` means "skip".
 * Whose week it is always comes from the session cookie.
 */
export async function POST(req: Request) {
  try {
    const me = await requireMe(req);
    const session = await jiraSession(req);
    const body = await req.json().catch(() => ({}));
    const day = String(body.week ?? new Date().toISOString().slice(0, 10));
    if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) throw new AdminError(400, "That week doesn't look right.");
    const weekStart = weekStartOf(day);

    const { value: signals } = await cached(session.accountId, `interview-signals|${weekStart}`, 120_000, () => collectSignals(me, session, weekStart));
    const gaps = findGaps(signals);
    const known = new Set(gaps.map((g) => g.id));

    let asked = strs(body.asked, MAX_QUESTIONS).filter((id) => known.has(id));
    let history: Turn[] = (Array.isArray(body.history) ? body.history : [])
      .slice(0, MAX_QUESTIONS)
      .map((t: { gapId?: unknown; answer?: unknown }) => ({ gapId: String(t?.gapId ?? "").slice(0, 120), answer: String(t?.answer ?? "").trim().slice(0, 500) }))
      .filter((t: Turn) => known.has(t.gapId) && t.answer);

    let saved = false;
    const a = body.answer as { gapId?: unknown; text?: unknown } | undefined;
    if (a) {
      const gap = gaps.find((g) => g.id === String(a.gapId));
      if (!gap) throw new AdminError(400, "That question isn't part of this week's interview.");
      if (!asked.includes(gap.id)) asked = [...asked, gap.id];
      const text = String(a.text ?? "").trim().slice(0, 2000);
      if (text) {
        // Dated inside the week it's about, so it lands in that week's report even when you answer later.
        const end = Date.parse(weekWindow(weekStart).toIso);
        const at = new Date(Math.min(Date.now(), end - 60_000)).toISOString();
        await addNote(me, { type: gap.noteType, text, at, source: "interview", jiraKey: gap.jiraKey, krId: gap.krId, visibility: "private" });
        history = [...history, { gapId: gap.id, answer: text.slice(0, 500) }];
        saved = true;
      }
    }

    const { next, usedModel } = await askNext(gaps, asked, history);
    return Response.json(
      { next, asked, history, saved, total: gaps.length, max: MAX_QUESTIONS, ai: usedModel, counts: counts(signals), sources: signals.sources },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
