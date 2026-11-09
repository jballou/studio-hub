import { apiError } from "@/lib/google/http";
import { requireMe } from "@/lib/me/session";
import { weekWindow } from "@/lib/me/week";
import { addNote, assertWeekStart, listNotes } from "@/lib/store/me";

const headers = { "Cache-Control": "private, no-store" };

/** GET /api/me/notes?week=YYYY-MM-DD(Monday)  My notes for that week, or all of them without it. */
export async function GET(req: Request) {
  try {
    const me = await requireMe(req);
    const week = new URL(req.url).searchParams.get("week");
    const w = week ? weekWindow(assertWeekStart(week)) : null;
    return Response.json({ notes: await listNotes(me, w ? { from: w.fromIso, to: w.toIso } : {}) }, { headers });
  } catch (e) {
    return apiError(e);
  }
}

/** POST { type, text, krId?, jiraKey?, at? }  Adds a private note. */
export async function POST(req: Request) {
  try {
    const me = await requireMe(req);
    const input = await req.json().catch(() => ({}));
    return Response.json({ note: await addNote(me, { ...input, source: "manual", visibility: "private" }) }, { status: 201, headers });
  } catch (e) {
    return apiError(e);
  }
}
