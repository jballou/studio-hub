import { driveList } from "@/lib/google/client";
import { apiError } from "@/lib/google/http";
import { cached } from "@/lib/jira/cache";
import { jiraSession } from "@/lib/jira/session";
import { getBrandConfig, markInTree } from "@/lib/store/brand";
import { AdminError } from "@/lib/store/users";

type Pic = { id: string; name: string; mimeType: string; size?: number; width?: number; height?: number };
const FULL_BLEED = /full[\s_-]*bleed/i;
const CUT_OUT = /cut[\s_-]*out/i;
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
    // Walking the folders is slow, so the list is remembered for ten minutes and each visit just draws from it.
    const { value: all } = await cached("brand", `wall2|${kind}|${root}`, 10 * 60_000, async () => {
      const walk = async (start: string[], keep: (folderName: string) => boolean) => {
        const out: Pic[] = [];
        let level = start;
        for (let depth = 0; depth < 5 && level.length && out.length < 3000; depth++) {
          const next: string[] = [];
          for (const folder of level) {
            const items = await driveList(owner, folder);
            markInTree(kind, items.map((i) => i.id));
            for (const i of items) {
              if (i.folder) { if (keep(i.name)) next.push(i.id); }
              else if (IMAGE.test(i.mimeType)) out.push({ id: i.id, name: i.name, mimeType: i.mimeType, size: i.size, width: i.width, height: i.height });
            }
          }
          level = next;
        }
        return out;
      };
      // Find every folder called "full-bleed ..." at any depth (up to four levels down) and use only what's inside them.
      const bleed: string[] = [];
      let level = [root];
      for (let depth = 0; depth < 4 && level.length; depth++) {
        const next: string[] = [];
        for (const folder of level) {
          const items = await driveList(owner, folder);
          markInTree(kind, items.map((i) => i.id));
          for (const i of items) if (i.folder) (FULL_BLEED.test(i.name) ? bleed : next).push(i.id);
        }
        level = next;
      }
      if (bleed.length) return walk(bleed, () => true);
      // No such folder: use everything except cut-outs, which don't suit a full-bleed wall.
      return walk([root], (n) => !CUT_OUT.test(n));
    });
    markInTree(kind, all.map((i) => i.id));

    const pool = [...all];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return Response.json({ items: pool.slice(0, 8) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
