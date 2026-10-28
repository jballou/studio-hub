import { errorResponse, jiraSession } from "@/lib/jira/session";
import { listNotifications, markRead } from "@/lib/store/notifications";

/** GET: your latest notifications and how many are unread. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    return Response.json(await listNotifications(s.accountId));
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST { ids?: string[] }: mark those read, or everything when no ids are given. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const b = await req.json().catch(() => ({}));
    const ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 100) : undefined;
    await markRead(s.accountId, ids);
    return Response.json(await listNotifications(s.accountId));
  } catch (e) {
    return errorResponse(e);
  }
}
