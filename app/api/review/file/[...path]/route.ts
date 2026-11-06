import { errorResponse, jiraSession } from "@/lib/jira/session";
import { fileInfo, filesAvailable, streamRange } from "@/lib/store/files";

const PART_RE = /^[A-Za-z0-9._ ()+-]{1,160}$/;

/** Streams an uploaded review file to a signed-in person. Passes Range through so video and audio can seek. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    await jiraSession(req);
    const parts = (await params).path.map((p) => decodeURIComponent(p));
    if (parts.length !== 2 || !parts.every((p) => PART_RE.test(p) && p !== "." && p !== "..")) return Response.json({ error: "Not found." }, { status: 404 });
    const range = req.headers.get("range");
    if (filesAvailable()) return serveFromRedis(parts[0], range);
    return Response.json({ error: "File storage isn't set up." }, { status: 503 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Uploaded files kept in Redis: answers Range requests so audio and video can seek. */
async function serveFromRedis(id: string, range: string | null): Promise<Response> {
  const meta = await fileInfo(id);
  if (!meta || !meta.complete) return Response.json({ error: "Not found." }, { status: 404 });
  const h = new Headers({ "Content-Type": meta.type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" });
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, meta.size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), meta.size - 1) : meta.size - 1;
    if (start > end || start >= meta.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${meta.size}` } });
    h.set("Content-Range", `bytes ${start}-${end}/${meta.size}`);
    h.set("Content-Length", String(end - start + 1));
    return new Response(streamRange(meta, start, end), { status: 206, headers: h });
  }
  h.set("Content-Length", String(meta.size));
  return new Response(streamRange(meta, 0, meta.size - 1), { status: 200, headers: h });
}
