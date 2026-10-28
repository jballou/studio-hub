// Small JSON document store on a private Vercel Blob store. Stand-in for a database until Postgres is approved.
//
// Safety model: every write is conditional on the ETag we read (`ifMatch`), so two people saving at the same
// moment cannot silently overwrite each other. The loser re-reads and re-applies its change (updateDoc retries).
// Not suitable for high write rates or big documents; keep documents small and split by entity.
import { createHash } from "node:crypto";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { getCache, waitUntil } from "@vercel/functions";

/** Separates production, preview and local data inside the one store. */
const PREFIX = `${process.env.VERCEL_ENV ?? "local"}/`;
const path = (name: string) => `${PREFIX}${name}.json`;

export type Doc<T> = { data: T; etag: string | null };

// Every read of a document used to be a Blob operation, and Blob stores on the Hobby plan are suspended when the
// month's free operations run out. So reads go through two caches first: this instance's memory (short) and the
// Vercel Runtime Cache shared by all instances (longer). Writes bypass both for their own read (they need the live
// ETag), then write the new copy into both, so the next reader sees it.
//   Staleness: another server instance may serve its memory copy for up to L1_MS after a write; fine for people, roles,
//   settings and your own lists.
const L1_MS = 20_000;
const L2_SECONDS = 120;
const l1 = new Map<string, { at: number; data: unknown }>();
const l2 = () => getCache({ namespace: "doc", keyHashFunction: (k: string) => createHash("sha256").update(k).digest("hex") });
const l2Key = (name: string) => path(name);

async function l2Get<T>(name: string): Promise<T | undefined> {
  try { return (await l2().get(l2Key(name))) as T | undefined; } catch { return undefined; }
}
function remember(name: string, data: unknown) {
  l1.set(name, { at: Date.now(), data });
  if (l1.size > 300) l1.delete(l1.keys().next().value as string);
  const p = Promise.resolve(l2().set(l2Key(name), data, { ttl: L2_SECONDS, name: "doc" })).catch(() => {});
  try { waitUntil(p); } catch { /* not on Vercel */ }
}

/** `fresh` skips the caches and reads the store itself. Writers use it; everything else should not. */
export async function readDoc<T>(name: string, empty: () => T, opts: { fresh?: boolean } = {}): Promise<Doc<T>> {
  if (!opts.fresh) {
    const hit = l1.get(name);
    if (hit && Date.now() - hit.at < L1_MS) return { data: structuredClone(hit.data) as T, etag: null };
    const shared = await l2Get<T>(name);
    if (shared !== undefined) { l1.set(name, { at: Date.now(), data: shared }); return { data: structuredClone(shared), etag: null }; }
  }
  const res = await get(path(name), { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) {
    const data = empty();
    if (!opts.fresh) remember(name, data);
    return { data, etag: null };
  }
  const text = await new Response(res.stream).text();
  const data = JSON.parse(text) as T;
  if (!opts.fresh) remember(name, data);
  // For larger documents the store hands back a weak tag (W/"...") on reads but only accepts the strong form
  // in conditional writes. The hash inside is the same, so drop the prefix.
  return { data, etag: res.blob.etag.replace(/^W\//, "") };
}

/**
 * Both "ETag no longer matches" and "another write is in flight right now" mean someone else got there first.
 * The second arrives as a plain BlobError, so it is recognized by message.
 */
function isConflict(e: unknown): boolean {
  return (
    e instanceof BlobPreconditionFailedError ||
    (e instanceof Error && /already exists|conflicting operation|precondition/i.test(e.message))
  );
}

/**
 * Read, change, write. `mutate` must be pure with respect to its input (it may run more than once).
 * Throw from `mutate` to abort without writing.
 */
export async function updateDoc<T, R = void>(
  name: string,
  empty: () => T,
  mutate: (data: T) => { data: T; result: R } | Promise<{ data: T; result: R }>,
  attempts = 6,
): Promise<R> {
  for (let i = 0; i < attempts; i++) {
    const { data, etag } = await readDoc(name, empty, { fresh: true });
    const out = await mutate(structuredClone(data));
    try {
      await put(path(name), JSON.stringify(out.data), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        // New doc: refuse to overwrite one that appeared meanwhile. Existing doc: only if unchanged since we read it.
        ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
      });
      remember(name, out.data); // the next reader gets this copy without touching the store
      return out.result;
    } catch (e) {
      if (!isConflict(e) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
    }
  }
  throw new Error("unreachable");
}
