import sharp from "sharp";
import { driveMedia, driveNode, driveThumbnail } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { getBrandConfig, inBrandTree } from "@/lib/store/brand";
import { AdminError } from "@/lib/store/users";

const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

/** GET /api/brand/drive/file/<id>?kind=...&mode=thumb|download  A brand-library file, only if it sits inside the configured folder. */
export async function GET(req: Request, ctx: RouteContext<"/api/brand/drive/file/[id]">) {
  try {
    await jiraSession(req);
    const { id } = await ctx.params;
    const u = new URL(req.url);
    const kind = u.searchParams.get("kind");
    if (!ID_RE.test(id) || (kind !== "photos" && kind !== "illustrations")) throw new AdminError(404, "Not found.");
    const cfg = await getBrandConfig();
    if (!cfg.owner || !(await inBrandTree(cfg, kind, id))) throw new AdminError(404, "Not found.");
    if (u.searchParams.get("mode") === "download" && u.searchParams.get("format") === "webp") {
      // WebP is made on request from the original in Drive, so the library holds one copy of each photo, not two.
      const [node, up] = await Promise.all([driveNode(cfg.owner, id), driveMedia(cfg.owner, id, null)]);
      if (!/^image\/(jpeg|png)$/.test(node.mimeType)) throw new AdminError(400, "Only JPG and PNG images can be saved as WebP.");
      const out = await sharp(Buffer.from(await up.arrayBuffer())).rotate().webp({ quality: 85 }).toBuffer();
      const name = node.name.replace(/\.[A-Za-z0-9]+$/, "") + ".webp";
      return new Response(new Uint8Array(out), { status: 200, headers: { "Content-Type": "image/webp", "Content-Length": String(out.length), "Cache-Control": "private, max-age=600", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });
    }
    if (u.searchParams.get("mode") === "download") {
      const [node, up] = await Promise.all([driveNode(cfg.owner, id), driveMedia(cfg.owner, id, null)]);
      const h = new Headers({ "Cache-Control": "private, max-age=600", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(node.name)}` });
      for (const k of ["content-type", "content-length"]) { const v = up.headers.get(k); if (v) h.set(k, v); }
      return new Response(up.body, { status: 200, headers: h });
    }
    const size = Math.min(1600, Math.max(64, Number(u.searchParams.get("s")) || 480));
    const node = await driveNode(cfg.owner, id).catch(() => null);
    if (node?.mimeType === "image/png") {
      // Drive's own preview flattens transparency to black, which makes a cut-out look like a photo on a black
      // background. For PNGs we shrink the original ourselves and keep the transparent pixels (as WebP).
      const up = await driveMedia(cfg.owner, id, null);
      const out = await sharp(Buffer.from(await up.arrayBuffer())).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
      return new Response(new Uint8Array(out), { status: 200, headers: { "Content-Type": "image/webp", "Content-Length": String(out.length), "Cache-Control": "private, max-age=86400" } });
    }
    const up = await driveThumbnail(cfg.owner, id, size);
    const h = new Headers({ "Cache-Control": "private, max-age=3600", "Content-Type": up.headers.get("content-type") ?? "image/jpeg" });
    return new Response(up.body, { status: 200, headers: h });
  } catch (e) {
    return apiError(e);
  }
}
