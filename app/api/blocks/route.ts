import { activeBlocks, blocksHeldBy, createBlock } from "@/lib/store/blocks";
import { cached, invalidateUser } from "@/lib/jira/cache";
import { getIssue, LIST_FIELDS, searchIssues, transitionToStatus } from "@/lib/jira/client";
import { jiraSyncFailure } from "@/lib/jira/sync";
import { toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { AdminError } from "@/lib/store/users";
import type { JiraSync } from "@/lib/types";

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * GET /api/blocks?keys=A-1,A-2   active blocks for those tickets (for tags in lists)
 * GET /api/blocks?mine=1         what is blocked on ME, with ticket details (the "Waiting on you" page)
 */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const p = new URL(req.url).searchParams;
    if (p.get("mine")) {
      const blocks = await blocksHeldBy(s.accountId);
      if (blocks.length === 0) return Response.json({ blocks: [] });
      // Runs as the blocker, so Jira only returns tickets they're allowed to see.
      const ks = blocks.map((b) => b.key).sort().join(",");
      const { value: projects } = await cached(s.accountId, `blocked-on-me|${ks}`, 60_000, async () => (await searchIssues(s.auth, `key in (${ks})`, LIST_FIELDS, 50)).map(toProject));
      const byKey = new Map(projects.map((p) => [p.jiraKey, p]));
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
    const key = String(body.key ?? "").trim().toUpperCase();
    // Remember where the ticket was so clearing the block can put it back; a ticket already Blocked has nothing to restore.
    let previousStatus: string | undefined;
    try {
      const current = (await getIssue(s.auth, key)).fields.status.name;
      if (current.toLowerCase() !== "blocked") previousStatus = current;
    } catch { /* the block is still recorded; Jira is told below */ }
    const block = await createBlock(s.email, { key, blockedBy: body.blockedBy, reason: String(body.reason ?? ""), previousStatus });
    // The block lives here either way; this only reports whether Jira's status followed.
    let jira: JiraSync;
    try {
      const r = await transitionToStatus(s.auth, key, "Blocked");
      jira = r === "no-transition" ? { ok: false, reason: "Jira's workflow doesn't allow moving this ticket to Blocked from its current status." } : { ok: true, changed: r === "moved", status: "Blocked" };
    } catch (e) {
      jira = await jiraSyncFailure(e, s.auth);
    }
    invalidateUser(s.accountId);
    return Response.json({ block, jira }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
