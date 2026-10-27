import { AdminError } from "@/lib/store/users";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { actorOf } from "@/lib/store/reviewSession";
import { getAsset, setReviewState } from "@/lib/store/review";
import type { ReviewState } from "@/lib/types";

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

/** PATCH { review: "awaiting" | "changes" | "approved" } */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const s = await jiraSession(req);
    const body = await req.json().catch(() => ({}));
    return Response.json({ asset: await setReviewState(actorOf(s), (await params).id, body.review as ReviewState) });
  } catch (e) {
    return errorResponse(e);
  }
}
