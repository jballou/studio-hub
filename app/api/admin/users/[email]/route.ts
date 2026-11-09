import { removeUser, updateUser, type UserRole, type UserStatus } from "@/lib/store/users";
import { adminSession, errorResponse } from "@/lib/jira/session";

const ROLES: UserRole[] = ["requester", "creative", "admin"];
const STATUSES: UserStatus[] = ["active", "disabled"];

/** PATCH { role?, status?, lead? } */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/users/[email]">) {
  try {
    const me = await adminSession(req);
    const { email } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const patch: { role?: UserRole; status?: UserStatus; lead?: boolean } = {};
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) return Response.json({ error: "Unknown role." }, { status: 400 });
      patch.role = body.role;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return Response.json({ error: "Unknown status." }, { status: 400 });
      patch.status = body.status;
    }
    if (body.lead !== undefined) {
      if (typeof body.lead !== "boolean") return Response.json({ error: "Team lead must be true or false." }, { status: 400 });
      patch.lead = body.lead;
    }
    const user = await updateUser(me.email, decodeURIComponent(email), patch);
    return Response.json({ user });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE: removes the record. Use PATCH status "disabled" to block access instead. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/users/[email]">) {
  try {
    const me = await adminSession(req);
    const { email } = await ctx.params;
    await removeUser(me.email, decodeURIComponent(email));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
