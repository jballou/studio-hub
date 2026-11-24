import { tagImage } from "@/lib/brand/tagger";
import { DRIVE_FOLDER, driveFile, driveList, driveThumbnail } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { jiraSession } from "@/lib/jira/session";
import { getBrandConfig, inBrandTree, markInTree } from "@/lib/store/brand";
import { allTags, saveTags } from "@/lib/store/tags";
import { AdminError } from "@/lib/store/users";

const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const IMAGE = /^image\/(jpeg|png|webp)$/;
const kindOf = (v: unknown) => { if (v !== "photos" && v !== "illustrations") throw new AdminError(400, "Unknown library."); return v; };

/** GET /api/brand/tags?kind=photos  Every tagged image's tags, for the preview's chips, related images and tag search. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const kind = kindOf(new URL(req.url).searchParams.get("kind"));
    return Response.json({ items: await allTags(kind) }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST { kind, id }     Reads one image and saves its tags. The creative team and admins only, since each one is a model call.
 * POST { kind, scan }   Admins: lists the images that have no tags yet, so the page can tag them one at a time.
 */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const b = await req.json().catch(() => ({}));
    const kind = kindOf(b.kind);
    const cfg = await getBrandConfig();
    if (!cfg[kind] || !cfg.owner) throw new AdminError(404, "This library isn't set up.");

    if (b.scan) {
      if (!s.isAdmin) throw new AdminError(403, "Admins only.");
      const done = await allTags(kind);
      const todo: string[] = [];
      let total = 0;
      let level = [cfg[kind]];
      for (let depth = 0; depth < 5 && level.length; depth++) {
        const next: string[] = [];
        for (const folder of level) {
          const items = await driveList(cfg.owner, folder);
          markInTree(kind, items.map((i) => i.id));
          for (const i of items) {
            if (i.folder) next.push(i.id);
            else if (IMAGE.test(i.mimeType)) { total++; if (!done[i.id]) todo.push(i.id); }
          }
        }
        level = next;
      }
      return Response.json({ total, todo });
    }

    if (s.role !== "creative" && !s.isAdmin) throw new AdminError(403, "Only the creative team can generate tags.");
    const id = String(b.id ?? "");
    if (!ID_RE.test(id) || !(await inBrandTree(cfg, kind, id))) throw new AdminError(404, "Not found.");
    const f = await driveFile(cfg.owner, id);
    if (f.mimeType === DRIVE_FOLDER || !IMAGE.test(f.mimeType)) throw new AdminError(400, "Only JPG, PNG and WebP images get tags.");
    const up = await driveThumbnail(cfg.owner, id, 768);
    const bytes = new Uint8Array(await up.arrayBuffer());
    const type = (up.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    const tags = await tagImage(bytes, /^image\/(jpeg|png|webp|gif)$/.test(type) ? type : "image/jpeg");
    const entry = { n: f.name, m: f.mimeType, s: f.size, t: tags, at: Date.now() };
    await saveTags(kind, id, entry);
    return Response.json({ id, entry });
  } catch (e) {
    return apiError(e);
  }
}
