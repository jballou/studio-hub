import { errorResponse, jiraSession } from "@/lib/jira/session";
import { getSettings } from "@/lib/store/settings";

/** GET  The organization settings, for any signed-in person (the Projects page uses it to say what it's showing). */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    return Response.json({ settings: await getSettings() });
  } catch (e) {
    return errorResponse(e);
  }
}
