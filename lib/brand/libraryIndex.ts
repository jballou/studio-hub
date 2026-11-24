import { driveList } from "@/lib/google/client";
import { cached } from "@/lib/jira/cache";
import { getBrandConfig, markInTree, type BrandKind } from "@/lib/store/brand";

export type Pic = { id: string; name: string; mimeType: string; size?: number; width?: number; height?: number };
const KEEP = /^(image\/(jpeg|png|webp|svg\+xml|gif)|application\/pdf)$/;

/** Every image in one library, from every folder. Walking Drive is slow, so it's remembered for ten minutes. */
export async function libraryIndex(kind: BrandKind): Promise<Pic[]> {
  const cfg = await getBrandConfig();
  const root = cfg[kind];
  const owner = cfg.owner;
  if (!root || !owner) return [];
  const { value } = await cached("brand", `index|${kind}|${root}`, 30 * 60_000, async () => {
    const out: Pic[] = [];
    let level = [root];
    for (let depth = 0; depth < 6 && level.length && out.length < 5000; depth++) {
      const next: string[] = [];
      for (const folder of level) {
        const items = await driveList(owner, folder);
        markInTree(kind, items.map((i) => i.id));
        for (const i of items) {
          if (i.folder) next.push(i.id);
          else if (KEEP.test(i.mimeType)) out.push({ id: i.id, name: i.name, mimeType: i.mimeType, size: i.size, width: i.width, height: i.height });
        }
      }
      level = next;
    }
    return out;
  });
  markInTree(kind, value.map((i) => i.id));
  return value;
}
