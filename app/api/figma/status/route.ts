import { errorResponse, jiraSession } from "@/lib/jira/session";

/** GET  Whether the app's shared Figma connection is set up. Figma is connected once for the whole team, not per person. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    return Response.json({ configured: !!process.env.FIGMA_ACCESS_TOKEN });
  } catch (e) {
    return errorResponse(e);
  }
}
