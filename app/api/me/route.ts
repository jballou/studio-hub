import { errorResponse, jiraSession } from "@/lib/jira/session";

export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    return Response.json({ name: s.name, email: s.email, role: s.role, isAdmin: s.isAdmin, accountId: s.accountId });
  } catch (e) {
    return errorResponse(e);
  }
}
