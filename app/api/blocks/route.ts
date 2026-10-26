import { activeBlocks, blocksHeldBy, createBlock } from "@/lib/store/blocks";
import { searchIssues } from "@/lib/jira/client";
import { toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { AdminError } from "@/lib/store/users";

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * GET /api/blocks?keys=A-1,A-2   active blocks for those tickets (for tags in lists)
 * GET /api/blocks?mine=1         what is blocked on ME, with ticket details (the "Blocking you" page)
 */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const p = new URL(req.url).searchParams;
    if (p.get("mine")) {
      const blocks = await blocksHeldBy(s.accountId);
      if (blocks.length === 0) return Response.json({ blocks: [] });
      // Runs as the blocker, so Jira only returns tickets they're allowed to see.
      const issues = await searchIssues(s.auth, `key in (${blocks.map((b) => b.key).join(",")})`, undefined, 50);
      const byKey = new Map(issues.map((i) => [i.key, toProject(i)]));
      return Response.json({ blocks: blocks.map((b) => ({ ...b, project: byKey.get(b.key) ?? null })) });
    }
    const keys = (p.get("keys") ?? "").split(",").map((k) => k.trim()).filter((k) => KEY_RE.test(k)).slice(0, 100);
    return Response.json({ blocks: keys.length ? await activeBlocks(keys) : [] });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST { key, blockedBy: {id,name,email?}, reason }  Creative team and admins only. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can mark a project as blocked.");
    const body = await req.json().catch(() => ({}));
    const block = await createBlock(s.email, { key: String(body.key ?? ""), blockedBy: body.blockedBy, reason: String(body.reason ?? "") });
    return Response.json({ block }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
