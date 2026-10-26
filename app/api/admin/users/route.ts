import { addUser, envAdmins, listUsers, readAudit, type UserRole } from "@/lib/store/users";
import { adminSession, errorResponse } from "@/lib/jira/session";

const ROLES: UserRole[] = ["requester", "creative", "admin"];

/** GET: everyone with access, who is locked in via the environment, and recent changes. */
export async function GET(req: Request) {
  try {
    const me = await adminSession(req);
    const [users, audit] = await Promise.all([listUsers(), readAudit(40)]);
    return Response.json({ users, envAdmins: envAdmins(), audit, me: me.email.toLowerCase() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST { email, role }: let someone in ahead of their first sign-in, with a role. */
export async function POST(req: Request) {
  try {
    const me = await adminSession(req);
    const body = await req.json().catch(() => ({}));
    const role = ROLES.includes(body.role) ? (body.role as UserRole) : "requester";
    const user = await addUser(me.email, String(body.email ?? ""), role);
    return Response.json({ user }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
