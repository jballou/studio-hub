import { driveList } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { cached } from "@/lib/jira/cache";
import { jiraSession } from "@/lib/jira/session";
import { getBrandConfig, markInTree } from "@/lib/store/brand";
import { AdminError } from "@/lib/store/users";

type Pic = { id: string; name: string; mimeType: string; size?: number; width?: number; height?: number };
const IMAGE = /^image\/(jpeg|png|webp|svg\+xml)$/;

/** GET /api/brand/drive/wall?kind=photos|illustrations  A random handful of images from every folder, for the inspiration wall. */
export async function GET(req: Request) {
  try {
    await jiraSession(req);
    const kind = new URL(req.url).searchParams.get("kind");
    if (kind !== "photos" && kind !== "illustrations") throw new AdminError(400, "Unknown library.");
    const cfg = await getBrandConfig();
    const root = cfg[kind];
    const owner = cfg.owner;
    if (!root || !owner) return Response.json({ items: [] });

    // Walking the folders is slow, so the whole list is remembered for ten minutes and each visit just draws from it.
    const { value: all } = await cached("brand", `wall|${kind}|${root}`, 10 * 60_000, async () => {
      const out: Pic[] = [];
      // Only the full-bleed retouched images make the wall; a library with no such folder uses everything.
      const top = await driveList(owner, root);
      markInTree(kind, top.map((i) => i.id));
      const bleed = top.filter((i) => i.folder && /full[\s_-]*bleed/i.test(i.name)).map((i) => i.id);
      for (const i of top) if (!i.folder && IMAGE.test(i.mimeType) && !bleed.length) out.push({ id: i.id, name: i.name, mimeType: i.mimeType, size: i.size, width: i.width, height: i.height });
      let level = bleed.length ? bleed : top.filter((i) => i.folder).map((i) => i.id);
      for (let depth = 0; depth < 5 && level.length && out.length < 3000; depth++) {
        const next: string[] = [];
        for (const folder of level) {
          const items = await driveList(owner, folder);
          markInTree(kind, items.map((i) => i.id));
          for (const i of items) {
            if (i.folder) next.push(i.id);
            else if (IMAGE.test(i.mimeType)) out.push({ id: i.id, name: i.name, mimeType: i.mimeType, size: i.size, width: i.width, height: i.height });
          }
        }
        level = next;
      }
      return out;
    });
    markInTree(kind, all.map((i) => i.id));

    const pool = [...all];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return Response.json({ items: pool.slice(0, 8) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
