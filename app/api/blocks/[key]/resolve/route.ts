import { resolveBlock } from "@/lib/store/blocks";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** POST { note? }  Clears a block. Allowed for the person it's blocked by, the creative team and admins. */
export async function POST(req: Request, ctx: RouteContext<"/api/blocks/[key]/resolve">) {
  try {
    const { key } = await ctx.params;
    const s = await jiraSession(req);
    const body = await req.json().catch(() => ({}));
    const block = await resolveBlock(
      { email: s.email, accountId: s.accountId, canManage: s.role === "creative" },
      decodeURIComponent(key),
      String(body.note ?? ""),
    );
    return Response.json({ block });
  } catch (e) {
    return errorResponse(e);
  }
}
