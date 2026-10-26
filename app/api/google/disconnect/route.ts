import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { deleteConnection, getConnection } from "@/lib/store/google";
import { audit } from "@/lib/store/users";

/** POST /api/google/disconnect  Revokes the grant at Google and forgets the tokens. Tasks already in Google Tasks stay there. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const c = await getConnection(s.email);
    if (c) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(c.refreshToken)}`, { method: "POST" }).catch(() => {});
      await deleteConnection(s.email);
      await audit({ actor: s.email, action: "google.disconnect", target: s.email }).catch(() => {});
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
