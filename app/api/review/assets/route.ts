import { errorResponse, jiraSession } from "@/lib/jira/session";
import { actorOf } from "@/lib/store/reviewSession";
import { getAsset, listAssets, submit, validateSubmission } from "@/lib/store/review";
import { audit } from "@/lib/store/users";
import { notify } from "@/lib/store/notifications";

/** GET /api/review/assets[?project=KEY]   designs you can open. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const project = new URL(req.url).searchParams.get("project") ?? undefined;
    return Response.json({ assets: await listAssets(actorOf(s), project?.toUpperCase()) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST a SubmitInput: a new design, or a new version of one you can open. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const input = validateSubmission(await req.json().catch(() => ({})));
    const res = await submit(actorOf(s), input);
    // Tell the people asked to review. A batch folds into one line (same key) with a count.
    const made = await getAsset(actorOf(s), res.assetId).catch(() => null);
    if (made) {
      const kind = input.existingAssetId ? "new-version" : "review-request";
      const to = [...(made.asset.reviewers ?? []), ...(made.asset.approvers ?? [])].map((p) => p.id).filter((id) => id !== s.accountId);
      await notify(to, {
        kind, key: input.batch ? `${kind}:batch:${input.batch.id}` : `${kind}:${made.asset.id}`, assetId: made.asset.id,
        assetName: input.batch?.title ?? made.asset.name, projectKey: made.asset.projectKey, fromName: s.name, count: input.batch ? 1 : undefined,
      });
    }
    await audit({ actor: s.email, action: "review.submit", target: input.projectKey, detail: input.title });
    return Response.json(res, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
