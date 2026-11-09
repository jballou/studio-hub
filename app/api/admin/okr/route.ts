import { SHEETS_SCOPE, configured } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { adminSession } from "@/lib/jira/session";
import { getConnection } from "@/lib/store/google";
import { getOkrConfig, getOkrMirror, loadSampleOkr, setOkrConfig, syncOkr } from "@/lib/store/okr";

async function overview(email: string) {
  const conn = configured() ? await getConnection(email) : null;
  return {
    config: await getOkrConfig(),
    mirror: await getOkrMirror(),
    google: { configured: configured(), connected: !!conn && !conn.broken, canReadSheets: !!conn?.scopes.includes(SHEETS_SCOPE) && !conn.broken },
  };
}

/** GET /api/admin/okr  Config, the last sync, and whether this admin's Google can read Sheets. */
export async function GET(req: Request) {
  try {
    const s = await adminSession(req);
    return Response.json(await overview(s.email));
  } catch (e) {
    return apiError(e);
  }
}

/** PUT { sheet, tabs }  Points the mirror at a Sheet. */
export async function PUT(req: Request) {
  try {
    const s = await adminSession(req);
    const body = await req.json().catch(() => ({}));
    await setOkrConfig(s.email, body);
    return Response.json(await overview(s.email));
  } catch (e) {
    return apiError(e);
  }
}

/** POST  Re-reads the Sheet with this admin's Google connection. POST { sample: true } loads made-up data instead. */
export async function POST(req: Request) {
  try {
    const s = await adminSession(req);
    const body = await req.json().catch(() => ({}));
    if (body.sample === true) await loadSampleOkr(s.email);
    else await syncOkr(s.email);
    return Response.json(await overview(s.email));
  } catch (e) {
    return apiError(e);
  }
}
