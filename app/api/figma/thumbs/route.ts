import { fetchThumbs, FigmaError } from "@/lib/figma";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** POST { key, ids: ["1:2", …] }  Thumbnail image URLs for those frames (50 at a time). */
export async function POST(req: Request) {
  try {
    await jiraSession(req);
    const token = process.env.FIGMA_ACCESS_TOKEN;
    if (!token) return Response.json({ urls: {} });
    const body = await req.json().catch(() => ({}));
    const key = String(body.key ?? "");
    if (!/^[A-Za-z0-9]{10,40}$/.test(key)) return Response.json({ error: "Bad file key." }, { status: 400 });
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    return Response.json({ urls: await fetchThumbs(token, key, ids) });
  } catch (e) {
    if (e instanceof FigmaError) return Response.json({ error: e.message }, { status: 502 });
    return errorResponse(e);
  }
}
