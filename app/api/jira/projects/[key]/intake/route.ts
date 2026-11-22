import { invalidateUser } from "@/lib/jira/cache";
import { JiraError } from "@/lib/jira/client";
import { runIntakeAction } from "@/lib/jira/intake";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { AdminError, audit } from "@/lib/store/users";
import type { IntakeAction } from "@/lib/types";

const ACTIONS: IntakeAction[] = ["info", "wontdo", "duplicate"];

/**
 * POST { action: "info" | "wontdo" | "duplicate", note?, duplicateOf? }  Triage a ticket nobody owns: send it back for
 * more information, or close it as won't do or a duplicate. Creative team only. Assigning uses the assignee route.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/jira/projects/[key]/intake">) {
  try {
    const { key: raw } = await ctx.params;
    const key = decodeURIComponent(raw).toUpperCase();
    const s = await jiraSession(req);
    if (s.role !== "creative") throw new AdminError(403, "Only the creative team can triage tickets.");
    const b = await req.json().catch(() => ({}));
    const action = b.action as IntakeAction;
    if (!ACTIONS.includes(action)) throw new JiraError(400, "Choose what to do with this ticket.");
    const result = await runIntakeAction(s.auth, key, { action, note: typeof b.note === "string" ? b.note : undefined, duplicateOf: typeof b.duplicateOf === "string" ? b.duplicateOf : undefined });
    invalidateUser(s.accountId);
    await audit({ actor: s.email, action: `ticket.intake.${action}`, target: key, detail: result.status });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
