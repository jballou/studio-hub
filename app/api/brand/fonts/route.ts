import { driveFile, driveMedia } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { FONT_LICENSE_VERSION } from "@/lib/brand/license";
import { jiraSession } from "@/lib/jira/session";
import { getBrandConfig } from "@/lib/store/brand";
import { AdminError, audit } from "@/lib/store/users";

/** GET: is the font download set up? (Never the file itself.) */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const cfg = await getBrandConfig();
    return Response.json({ available: !!(cfg.fonts && cfg.owner), version: FONT_LICENSE_VERSION });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST { agree: true, version }  Records the person's acceptance of the license terms, then sends the font file.
 * There is no GET for the file, so the only way to it is through an accepted agreement, which is saved in the audit log.
 */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const b = await req.json().catch(() => ({}));
    if (b.agree !== true) throw new AdminError(400, "Accept the license terms to download the font.");
    if (b.version !== FONT_LICENSE_VERSION) throw new AdminError(409, "The license terms were updated. Reload the page and read them again.");
    const cfg = await getBrandConfig();
    if (!cfg.fonts || !cfg.owner) throw new AdminError(503, "The font file hasn't been added yet. Ask a Brand Creative admin.");
    const [file, up] = await Promise.all([driveFile(cfg.owner, cfg.fonts), driveMedia(cfg.owner, cfg.fonts, null)]);
    await audit({ actor: s.email, action: "font.download", target: "National 2", detail: `terms ${FONT_LICENSE_VERSION}` });
    const h = new Headers({ "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, "X-Content-Type-Options": "nosniff" });
    for (const k of ["content-type", "content-length"]) { const v = up.headers.get(k); if (v) h.set(k, v); }
    return new Response(up.body, { status: 200, headers: h });
  } catch (e) {
    return apiError(e);
  }
}
