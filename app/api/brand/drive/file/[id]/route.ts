import { waitUntil } from "@vercel/functions";
import sharp from "sharp";
import { readThumb, saveThumb, snapSize } from "@/lib/brand/thumbCache";
import { driveMedia, driveNode, driveThumbnail } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { getBrandConfig, inBrandTree } from "@/lib/store/brand";
import { AdminError } from "@/lib/store/users";

export const maxDuration = 60;

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
    const size = snapSize(Math.min(1600, Math.max(64, Number(u.searchParams.get("s")) || 480)));
    const kept = await readThumb(kind, id, size);
    if (kept) return kept;
    // The page says whether it's a PNG, which saves a Drive round trip per image; without the hint we ask Drive.
    const hint = u.searchParams.get("m");
    const png = hint ? hint === "png" : (await driveNode(cfg.owner, id).catch(() => null))?.mimeType === "image/png";
    if (png) {
      // Drive's own preview flattens transparency to black, which makes a cut-out look like a photo on a black
      // background. For PNGs we shrink the original ourselves and keep the transparent pixels (as WebP).
      const up = await driveMedia(cfg.owner, id, null);
      const out = await sharp(Buffer.from(await up.arrayBuffer())).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
      waitUntil(saveThumb(kind, id, size, new Uint8Array(out), "image/webp"));
      return new Response(new Uint8Array(out), { status: 200, headers: { "Content-Type": "image/webp", "Content-Length": String(out.length), "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" } });
    }
    const up = await driveThumbnail(cfg.owner, id, size);
    const bytes = new Uint8Array(await up.arrayBuffer());
    const type = up.headers.get("content-type") ?? "image/jpeg";
    waitUntil(saveThumb(kind, id, size, bytes, type));
    return new Response(bytes, { status: 200, headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800", "Content-Type": type } });
  } catch (e) {
    return apiError(e);
  }
}
