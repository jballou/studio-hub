import { AdminError } from "@/lib/store/users";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { audit } from "@/lib/store/users";
import { notify } from "@/lib/store/notifications";
import { actorOf } from "@/lib/store/reviewSession";
import { getAsset, moveToTrash, setReviewState, updateSharing } from "@/lib/store/review";
import type { ReviewState, ShareChange } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const s = await jiraSession(req);
    const found = await getAsset(actorOf(s), (await params).id);
    if (!found) throw new AdminError(404, "That design doesn't exist, or you don't have access to it.");
    return Response.json(found);
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH { review: "awaiting" | "changes" | "approved" }  or  { share: { add, remove, linkAccess } } */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const s = await jiraSession(req);
    const body = await req.json().catch(() => ({}));
    const id = (await params).id;
    const who = actorOf(s);
    if (body.share) {
      const change = body.share as ShareChange;
      const before = await getAsset(who, id).catch(() => null);
      const asset = await updateSharing(who, id, change);
      // Only people who weren't already on it hear about being added.
      const had = new Set([...(before?.asset.reviewers ?? []), ...(before?.asset.approvers ?? [])].map((p) => p.id));
      const added = (Array.isArray(change.add) ? change.add : []).map((x) => String(x?.person?.id ?? "")).filter((pid) => pid && pid !== s.accountId && !had.has(pid));
      await notify(added, { kind: "added", key: `added:${asset.id}`, assetId: asset.id, assetName: asset.name, projectKey: asset.projectKey, fromName: s.name });
      return Response.json({ asset });
    }
    const asset = await setReviewState(who, id, body.review as ReviewState);
    if ((asset.review === "approved" || asset.review === "changes") && asset.submittedBy && asset.submittedBy !== s.accountId) {
      await notify([asset.submittedBy], { kind: asset.review, key: `${asset.review}:${asset.id}`, assetId: asset.id, assetName: asset.name, projectKey: asset.projectKey, fromName: s.name });
    }
    return Response.json({ asset });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE moves the design to Trash (restorable for 30 days). */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const s = await jiraSession(req);
    const asset = await moveToTrash(actorOf(s), (await params).id);
    await audit({ actor: s.email, action: "review.trash", target: asset.projectKey, detail: asset.name });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
