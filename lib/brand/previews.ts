import sharp from "sharp";
import { libraryIndex } from "@/lib/brand/libraryIndex";
import { saveThumb } from "@/lib/brand/thumbCache";
import { driveMedia } from "@/lib/google/client";
import { getBrandConfig, type BrandKind } from "@/lib/store/brand";
import { alphaFlags, saveAlphaFlags } from "@/lib/store/previews";

/** The preview sizes the library asks for (tiles, the wall, large tiles and the full preview). */
const WARM_SIZES = [320, 800, 1000, 1600];

/** True when any pixel is see-through. Judged on a small copy, which is plenty for a cut-out's empty background. */
export async function hasTransparency(original: Buffer): Promise<boolean> {
  const meta = await sharp(original).metadata();
  if (!meta.hasAlpha) return false;
  const { channels } = await sharp(original).resize({ width: 256, withoutEnlargement: true }).ensureAlpha().stats();
  return (channels[3]?.min ?? 255) < 250;
}

export const toWebp = (original: Buffer, size: number) =>
  sharp(original).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();

/**
 * Makes the cached previews for PNGs nobody has opened yet, so the first view is already fast. Each original is downloaded once,
 * shrunk to every size the library uses, and checked for transparency. Returns how many PNGs are still waiting.
 */
export async function warmPreviews(kind: BrandKind, budgetMs: number): Promise<{ done: number; failed: number; remaining: number }> {
  const cfg = await getBrandConfig();
  const owner = cfg.owner;
  if (!cfg[kind] || !owner) return { done: 0, failed: 0, remaining: 0 };
  const have = await alphaFlags(kind);
  const todo = (await libraryIndex(kind)).filter((p) => p.mimeType === "image/png" && have[p.id] === undefined);
  const stop = Date.now() + budgetMs;
  const flags: Record<string, 0 | 1> = {};
  let i = 0, done = 0, failed = 0;
  // Two at a time: a large PNG is a lot of memory to decode.
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (i < todo.length && Date.now() < stop) {
      const p = todo[i++];
      try {
        const original = Buffer.from(await (await driveMedia(owner, p.id, null)).arrayBuffer());
        const alpha = await hasTransparency(original);
        for (const size of WARM_SIZES) await saveThumb(kind, p.id, size, new Uint8Array(await toWebp(original, size)), "image/webp");
        flags[p.id] = alpha ? 1 : 0;
        done++;
      } catch (e) {
        failed++;
        console.error("preview warm-up failed", p.id, e);
      }
    }
  }));
  await saveAlphaFlags(kind, flags);
  return { done, failed, remaining: Math.max(0, todo.length - done) };
}
