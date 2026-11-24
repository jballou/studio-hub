import { libraryIndex } from "@/lib/brand/libraryIndex";
import { tagBatch } from "@/lib/brand/tagLibrary";
import { tagImage } from "@/lib/brand/tagger";
import { DRIVE_FOLDER, driveFile, driveThumbnail } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { jiraSession, type JiraSession } from "@/lib/jira/session";
import { getBrandConfig, inBrandTree } from "@/lib/store/brand";
import { allTags, cleanTag, cleanTags, editTags, rewriteTag, saveTags } from "@/lib/store/tags";
import { AdminError, audit } from "@/lib/store/users";

export const maxDuration = 300;

const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const IMAGE = /^image\/(jpeg|png|webp)$/;
const kindOf = (v: unknown) => { if (v !== "photos" && v !== "illustrations") throw new AdminError(400, "Unknown library."); return v; };
const crew = (s: JiraSession) => { if (s.role !== "creative" && !s.isAdmin) throw new AdminError(403, "Only the creative team can change tags."); };

/** GET /api/brand/tags?kind=photos  Every tagged image's tags, for the preview's chips, related images and the tag manager. */
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
 * POST { kind, status }  How many images the library has and how many still have no tags.
 * POST { kind, run }     Tags a batch of untagged images (call again while `remaining` is above zero).
 * POST { kind, id }      Reads one image and saves its tags.
 * The creative team and admins only, since each one is a model call.
 */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    crew(s);
    const b = await req.json().catch(() => ({}));
    const kind = kindOf(b.kind);
    const cfg = await getBrandConfig();
    if (!cfg[kind] || !cfg.owner) throw new AdminError(404, "This library isn't set up.");

    if (b.status || b.scan) {
      const [index, done] = await Promise.all([libraryIndex(kind), allTags(kind)]);
      const images = index.filter((p) => IMAGE.test(p.mimeType));
      const todo = images.filter((p) => !done[p.id]).map((p) => p.id);
      return Response.json({ total: images.length, tagged: images.length - todo.length, todo });
    }
    if (b.run) return Response.json(await tagBatch(kind, 240_000));

    const id = String(b.id ?? "");
    if (!ID_RE.test(id) || !(await inBrandTree(cfg, kind, id))) throw new AdminError(404, "Not found.");
    const f = await driveFile(cfg.owner, id);
    if (f.mimeType === DRIVE_FOLDER || !IMAGE.test(f.mimeType)) throw new AdminError(400, "Only JPG, PNG and WebP images get tags.");
    const up = await driveThumbnail(cfg.owner, id, 768);
    const bytes = new Uint8Array(await up.arrayBuffer());
    const type = (up.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    const tags = await tagImage(bytes, /^image\/(jpeg|png|webp|gif)$/.test(type) ? type : "image/jpeg");
    const entry = await saveTags(kind, id, { n: f.name, m: f.mimeType, s: f.size, t: tags, at: Date.now() });
    return Response.json({ id, entry });
  } catch (e) {
    return apiError(e);
  }
}

/** PUT { kind, id, tags }  Replaces one image's tags with the creative team's own list. */
export async function PUT(req: Request) {
  try {
    const s = await jiraSession(req);
    crew(s);
    const b = await req.json().catch(() => ({}));
    const kind = kindOf(b.kind);
    const id = String(b.id ?? "");
    if (!ID_RE.test(id)) throw new AdminError(404, "Not found.");
    const entry = await editTags(kind, id, cleanTags(b.tags));
    if (!entry) throw new AdminError(404, "That image hasn't been tagged yet.");
    return Response.json({ id, entry });
  } catch (e) {
    return apiError(e);
  }
}

/** PATCH { kind, from, to }  Renames a tag everywhere (merging if the new name exists). PATCH { kind, from, remove: true } deletes it everywhere. */
export async function PATCH(req: Request) {
  try {
    const s = await jiraSession(req);
    crew(s);
    const b = await req.json().catch(() => ({}));
    const kind = kindOf(b.kind);
    const from = cleanTag(String(b.from ?? ""));
    const to = b.remove ? null : cleanTag(String(b.to ?? ""));
    if (!from || (to !== null && !to)) throw new AdminError(400, "Give the tag a name.");
    const changed = await rewriteTag(kind, from, to);
    await audit({ actor: s.email, action: to === null ? "tags.delete" : "tags.rename", target: `${kind}: ${from}`, detail: `${to ? `to ${to}, ` : ""}${changed} images` });
    return Response.json({ changed });
  } catch (e) {
    return apiError(e);
  }
}
