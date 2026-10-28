import { AdminError, audit } from "@/lib/store/users";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { listTrash, purge, restoreFromTrash, TRASH_DAYS } from "@/lib/store/review";

/** GET: what is in Trash (creative team and admins). Anything past 30 days is removed first. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can see Trash.");
    await purge({ expiredOnly: true }).catch(() => 0);
    return Response.json({ items: await listTrash(), days: TRASH_DAYS });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST { op: "restore", id }  creative team   ·   { op: "purge", id } or { op: "empty" }  admins only, permanent */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can use Trash.");
    const b = await req.json().catch(() => ({}));
    if (b.op === "restore") {
      const a = await restoreFromTrash(String(b.id ?? ""));
      await audit({ actor: s.email, action: "review.restore", target: a.projectKey, detail: a.name });
      return Response.json({ ok: true });
    }
    if (b.op === "purge" || b.op === "empty") {
      if (!s.isAdmin) throw new AdminError(403, "Only admins can delete for good.");
      const n = await purge(b.op === "purge" ? { ids: [String(b.id ?? "")], expiredOnly: false } : { expiredOnly: false });
      await audit({ actor: s.email, action: b.op === "purge" ? "review.purge" : "review.empty-trash", target: "trash", detail: `${n} removed` });
      return Response.json({ ok: true, removed: n });
    }
    return Response.json({ error: "Unknown request." }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
