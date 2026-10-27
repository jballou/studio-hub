import { errorResponse, jiraSession } from "@/lib/jira/session";
import { actorOf } from "@/lib/store/reviewSession";
import { addIssueComment } from "@/lib/jira/client";
import { changeThread, createThread, getThreadForPush, listThreads, recordPush } from "@/lib/store/review";
import { formatTime } from "@/lib/timecode";

/** GET /api/review/threads?versionId=… */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const versionId = new URL(req.url).searchParams.get("versionId") ?? "";
    return Response.json({ threads: await listThreads(actorOf(s), versionId) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST { op: "create", versionId, body, anchor, timeMs, page }
 *      { op: "reply" | "status" | "anchor", versionId, threadId, ... }
 *      { op: "push", versionId, threadId }   post this comment to the Jira ticket (once)
 */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const who = actorOf(s);
    const b = await req.json().catch(() => ({}));
    const versionId = String(b.versionId ?? "");
    if (b.op === "create") return Response.json({ thread: await createThread(who, { versionId, body: b.body, anchor: b.anchor, timeMs: b.timeMs, page: b.page }) }, { status: 201 });
    const threadId = String(b.threadId ?? "");
    if (b.op === "push") {
      const { thread, asset, version } = await getThreadForPush(who, versionId, threadId);
      if (thread.jira) return Response.json({ thread }); // never duplicate on re-push
      const where = thread.timeMs != null ? ` at ${formatTime(thread.timeMs)}` : thread.page ? ` on page ${thread.page}` : "";
      const lines = [
        `Review comment #${thread.number} on "${asset.name}" (version ${version.number})${where}`,
        ...thread.comments.flatMap((c) => [`${c.authorName ?? "Someone"}: ${c.body}`]),
        "",
        `Open in the Brand Creative Hub: ${new URL(req.url).origin}/review/${asset.id}`,
      ];
      try {
        const commentId = await addIssueComment(s.auth, asset.projectKey, lines);
        return Response.json({ thread: await recordPush(versionId, threadId, { commentId }) });
      } catch (e) {
        const msg = e instanceof Error && /40[13]/.test(String((e as { status?: number }).status)) ? "Jira wouldn't take the comment (your sign-in may need write access, or the ticket is restricted)." : "Couldn't post to Jira. Try again.";
        return Response.json({ thread: await recordPush(versionId, threadId, { error: msg }) });
      }
    }
    if (b.op === "reply" || b.op === "status" || b.op === "anchor") {
      return Response.json({ thread: await changeThread(who, versionId, threadId, b) });
    }
    return Response.json({ error: "Unknown request." }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
