import { fetchFile, FigmaError, parseFigmaLink } from "@/lib/figma";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/**
 * GET /api/figma/frames?url=<figma link>  The file's pages and frames, for the "choose frames" picker.
 * Uses one shared Figma access token (FIGMA_ACCESS_TOKEN), so it can only see files that account can open.
 */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const token = process.env.FIGMA_ACCESS_TOKEN;
    if (!token) return Response.json({ configured: false }, { status: 200 });
    const link = parseFigmaLink(new URL(req.url).searchParams.get("url") ?? "");
    if (!link) return Response.json({ error: "Paste a Figma design link (Share → Copy link)." }, { status: 400 });
    const file = await fetchFile(token, link.key);
    return Response.json({ configured: true, file, selected: link.nodeId });
  } catch (e) {
    if (e instanceof FigmaError) return Response.json({ configured: true, error: e.message }, { status: e.status === 400 ? 400 : 502 });
    return errorResponse(e);
  }
}
