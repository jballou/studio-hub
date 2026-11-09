import { apiError } from "@/lib/google/http";
import { requireMe } from "@/lib/me/session";
import { deleteNote, updateNote } from "@/lib/store/me";

const headers = { "Cache-Control": "private, no-store" };

/** PATCH { type?, text?, krId?, jiraKey? }  Edit one of my notes. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/me/notes/[id]">) {
  try {
    const me = await requireMe(req);
    const { id } = await ctx.params;
    const input = await req.json().catch(() => ({}));
    // Where a note came from and who can see it aren't editable here.
    const { type, text, krId, jiraKey } = input;
    return Response.json({ note: await updateNote(me, id, { type, text, krId, jiraKey }) }, { headers });
  } catch (e) {
    return apiError(e);
  }
}

/** DELETE  Remove one of my notes. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/me/notes/[id]">) {
  try {
    const me = await requireMe(req);
    const { id } = await ctx.params;
    await deleteNote(me, id);
    return Response.json({ ok: true }, { headers });
  } catch (e) {
    return apiError(e);
  }
}
