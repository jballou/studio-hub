import { apiError } from "@/lib/google/http";
import { driveMedia } from "@/lib/google/client";
import { jiraSession } from "@/lib/jira/session";
import { AdminError } from "@/lib/store/users";

const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

/**
 * Streams a Drive file to the review player using the VIEWER'S Google connection, so only people who can open the file
 * in Drive can play it. Passes Range through so seeking works.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/review/stream/drive/[id]">) {
  try {
    const s = await jiraSession(req);
    const { id } = await ctx.params;
    if (!ID_RE.test(id)) throw new AdminError(404, "Not found.");
    const up = await driveMedia(s.email, id, req.headers.get("range"));
    const h = new Headers({ "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=600" });
    for (const k of ["content-type", "content-length", "content-range"]) { const v = up.headers.get(k); if (v) h.set(k, v); }
    return new Response(up.body, { status: up.status === 206 ? 206 : up.ok ? 200 : up.status, headers: h });
  } catch (e) {
    return apiError(e);
  }
}
