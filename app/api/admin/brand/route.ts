import { DRIVE_SCOPE, configured } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { adminSession } from "@/lib/jira/session";
import { getConnection } from "@/lib/store/google";
import { getBrandConfig, setBrandConfig } from "@/lib/store/brand";

async function overview(email: string) {
  const conn = configured() ? await getConnection(email) : null;
  const cfg = await getBrandConfig();
  return {
    config: { photos: cfg.photos ? `https://drive.google.com/drive/folders/${cfg.photos}` : "", illustrations: cfg.illustrations ? `https://drive.google.com/drive/folders/${cfg.illustrations}` : "", owner: cfg.owner },
    google: { configured: configured(), connected: !!conn && !conn.broken, canReadDrive: !!conn?.scopes.includes(DRIVE_SCOPE) && !conn.broken },
  };
}

/** GET /api/admin/brand  The Drive folders behind Photos and Illustrations, and whether this admin's Google can read Drive. */
export async function GET(req: Request) {
  try {
    const s = await adminSession(req);
    return Response.json(await overview(s.email));
  } catch (e) {
    return apiError(e);
  }
}

/** PUT { photos, illustrations }  Saves the Drive folder links. This admin's Google connection is what reads them. */
export async function PUT(req: Request) {
  try {
    const s = await adminSession(req);
    const body = await req.json().catch(() => ({}));
    await setBrandConfig(s.email, body);
    return Response.json(await overview(s.email));
  } catch (e) {
    return apiError(e);
  }
}
