import { jiraSession } from "@/lib/jira/session";
import { getAvatar } from "@/lib/store/avatars";

/** GET /api/avatars/<accountId>?v=<version>  A profile picture. The version in the URL lets browsers keep it for a day. */
export async function GET(req: Request, ctx: RouteContext<"/api/avatars/[id]">) {
  try {
    await jiraSession(req);
    const { id } = await ctx.params;
    const img = await getAvatar(decodeURIComponent(id));
    if (!img) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(img), { headers: { "Content-Type": "image/webp", "Content-Length": String(img.length), "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
