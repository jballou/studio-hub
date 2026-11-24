import { tagImage } from "@/lib/brand/tagger";
import { libraryIndex } from "@/lib/brand/libraryIndex";
import { driveThumbnail } from "@/lib/google/client";
import { getBrandConfig, type BrandKind } from "@/lib/store/brand";
import { allTags, releaseTagLock, saveTags, takeTagLock } from "@/lib/store/tags";

const TAGGABLE = /^image\/(jpeg|png|webp)$/;

/** Tags images that have no tags yet, a few at a time, until the time budget runs out. Returns how many are left. */
export async function tagBatch(kind: BrandKind, budgetMs: number): Promise<{ done: number; failed: number; remaining: number }> {
  const cfg = await getBrandConfig();
  const owner = cfg.owner;
  if (!cfg[kind] || !owner) return { done: 0, failed: 0, remaining: 0 };
  const have = await allTags(kind);
  const todo = (await libraryIndex(kind)).filter((p) => TAGGABLE.test(p.mimeType) && !have[p.id]);
  const stop = Date.now() + budgetMs;
  let i = 0, done = 0, failed = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length && Date.now() < stop) {
      const p = todo[i++];
      try {
        const up = await driveThumbnail(owner, p.id, 768);
        const bytes = new Uint8Array(await up.arrayBuffer());
        const type = (up.headers.get("content-type") ?? "image/jpeg").split(";")[0];
        const tags = await tagImage(bytes, /^image\/(jpeg|png|webp|gif)$/.test(type) ? type : "image/jpeg");
        await saveTags(kind, p.id, { n: p.name, m: p.mimeType, s: p.size, t: tags, at: Date.now() });
        done++;
      } catch { failed++; }
    }
  }));
  return { done, failed, remaining: Math.max(0, todo.length - done) };
}

/** Starts tagging in the background if nothing else is already doing it. Safe to call on every visit. */
export async function kickTagging(kind: BrandKind): Promise<void> {
  try {
    if (!(await takeTagLock(kind, 280_000))) return;
    const r = await tagBatch(kind, 240_000);
    // Nothing left: leave it alone for half an hour. Failures: try again in five minutes.
    await releaseTagLock(kind, r.remaining === 0 ? 30 * 60_000 : r.done === 0 ? 5 * 60_000 : 0);
  } catch {
    await releaseTagLock(kind, 5 * 60_000).catch(() => {});
  }
}
