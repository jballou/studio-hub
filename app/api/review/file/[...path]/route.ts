import { get } from "@vercel/blob";
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
    const res = await get(`review-files/${parts.join("/")}`, { access: "private", headers: range ? { Range: range } : undefined });
    if (!res || res.statusCode !== 200) return Response.json({ error: "Not found." }, { status: 404 });
    const h = new Headers();
    h.set("Content-Type", res.blob.contentType);
    h.set("Accept-Ranges", "bytes");
    h.set("Cache-Control", "private, max-age=3600");
    const size = res.blob.size;
    const upstreamRange = res.headers.get("content-range");
    if (upstreamRange) {
      // The store honored Range itself.
      h.set("Content-Range", upstreamRange);
      const len = res.headers.get("content-length");
      if (len) h.set("Content-Length", len);
      return new Response(res.stream, { status: 206, headers: h });
    }
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (m && (m[1] || m[2])) {
      // It sent the whole file; cut out the requested bytes ourselves so seeking still works.
      let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      let end = m[1] && m[2] ? Number(m[2]) : size - 1;
      end = Math.min(end, size - 1);
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      start = Math.max(0, start);
      const reader = res.stream.getReader();
      let pos = 0;
      const sliced = new ReadableStream<Uint8Array>({
        async pull(controller) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); return; }
            const chunkStart = pos;
            pos += value.length;
            if (pos <= start) continue;
            const from = Math.max(0, start - chunkStart);
            const to = Math.min(value.length, end + 1 - chunkStart);
            if (to > from) controller.enqueue(value.subarray(from, to));
            if (pos > end) { controller.close(); await reader.cancel(); return; }
            return;
          }
        },
        cancel: () => reader.cancel(),
      });
      h.set("Content-Range", `bytes ${start}-${end}/${size}`);
      h.set("Content-Length", String(end - start + 1));
      return new Response(sliced, { status: 206, headers: h });
    }
    h.set("Content-Length", String(size));
    return new Response(res.stream, { status: 200, headers: h });
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
