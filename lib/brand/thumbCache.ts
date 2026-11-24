import { get, put } from "@vercel/blob";
import { PREFIX } from "@/lib/store/doc";

// Resized previews are kept in the blob store, so a photo is fetched from Drive and shrunk once, not on every view.
// A copy is refreshed after a week, in case the file in Drive was replaced.
const FRESH_MS = 7 * 24 * 3600_000;
const key = (kind: string, id: string, size: number) => `${PREFIX}thumbs/${kind}/${id}-${size}`;
/** The sizes the library asks for, so each image has a handful of cached copies at most. */
export const snapSize = (n: number) => [200, 320, 480, 800, 1000, 1600].find((s) => s >= n) ?? 1600;

export async function readThumb(kind: string, id: string, size: number): Promise<Response | null> {
  try {
    const r = await get(key(kind, id, size), { access: "private" });
    if (!r || r.statusCode !== 200 || Date.now() - r.blob.uploadedAt.getTime() > FRESH_MS) return null;
    return new Response(r.stream, { status: 200, headers: { "Content-Type": r.blob.contentType || "image/jpeg", "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" } });
  } catch { return null; }
}

export async function saveThumb(kind: string, id: string, size: number, bytes: Uint8Array, contentType: string): Promise<void> {
  try { await put(key(kind, id, size), Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true }); } catch { /* the next view just makes it again */ }
}
