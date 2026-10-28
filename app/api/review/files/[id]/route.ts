import { errorResponse, jiraSession } from "@/lib/jira/session";
import { CHUNK_BYTES, finishUpload, putChunk } from "@/lib/store/files";

/** PUT ?i=N with the raw bytes of chunk N. */
export async function PUT(req: Request, ctx: RouteContext<"/api/review/files/[id]">) {
  try {
    const s = await jiraSession(req);
    const { id } = await ctx.params;
    const index = Number(new URL(req.url).searchParams.get("i"));
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength > CHUNK_BYTES) return Response.json({ error: "That chunk is too big." }, { status: 413 });
    await putChunk(s.accountId, id, index, bytes);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST  Finishes the upload once every chunk has arrived. */
export async function POST(req: Request, ctx: RouteContext<"/api/review/files/[id]">) {
  try {
    const s = await jiraSession(req);
    const { id } = await ctx.params;
    const meta = await finishUpload(s.accountId, id);
    return Response.json({ id: meta.id, url: `/api/review/file/${meta.id}/${encodeURIComponent(meta.name)}` });
  } catch (e) {
    return errorResponse(e);
  }
}
