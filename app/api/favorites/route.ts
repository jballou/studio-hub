import { listFavorites, toggleFavorite } from "@/lib/store/favorites";
import { JiraError } from "@/lib/jira/client";
import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET: my starred projects. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    return Response.json({ favorites: await listFavorites(s.accountId) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT { key, title, on }: star or unstar a project. */
export async function PUT(req: Request) {
  try {
    const s = await jiraSession(req);
    const b = await req.json().catch(() => ({}));
    const favorites = await toggleFavorite(s.accountId, String(b.key ?? ""), String(b.title ?? ""), b.on !== false);
    return Response.json({ favorites });
  } catch (e) {
    return errorResponse(e instanceof Error && e.message === "bad key" ? new JiraError(400, "That doesn't look like a Jira key.") : e);
  }
}
