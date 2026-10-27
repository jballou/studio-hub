import { errorResponse, jiraSession } from "@/lib/jira/session";
import { actorOf } from "@/lib/store/reviewSession";
import { listAssets, submit, validateSubmission } from "@/lib/store/review";
import { audit } from "@/lib/store/users";

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
    await audit({ actor: s.email, action: "review.submit", target: input.projectKey, detail: input.title });
    return Response.json(res, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
