import { adminSession, errorResponse } from "@/lib/jira/session";
import { getSettings, updateSettings } from "@/lib/store/settings";

export async function GET(req: Request) {
  try {
    await adminSession(req);
    return Response.json({ settings: await getSettings() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT { projectLookbackDays }  Admins only. */
export async function PUT(req: Request) {
  try {
    const s = await adminSession(req);
    const body = await req.json().catch(() => ({}));
    return Response.json({ settings: await updateSettings(s.email, { projectLookbackDays: body.projectLookbackDays }) });
  } catch (e) {
    return errorResponse(e);
  }
}
