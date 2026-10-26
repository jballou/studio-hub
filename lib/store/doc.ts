// Small JSON document store on a private Vercel Blob store. Stand-in for a database until Postgres is approved.
//
// Safety model: every write is conditional on the ETag we read (`ifMatch`), so two people saving at the same
// moment cannot silently overwrite each other. The loser re-reads and re-applies its change (updateDoc retries).
// Not suitable for high write rates or big documents; keep documents small and split by entity.
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

/** Separates production, preview and local data inside the one store. */
const PREFIX = `${process.env.VERCEL_ENV ?? "local"}/`;
const path = (name: string) => `${PREFIX}${name}.json`;

export type Doc<T> = { data: T; etag: string | null };

export async function readDoc<T>(name: string, empty: () => T): Promise<Doc<T>> {
  const res = await get(path(name), { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { data: empty(), etag: null };
  const text = await new Response(res.stream).text();
  // For larger documents the store hands back a weak tag (W/"...") on reads but only accepts the strong form
  // in conditional writes. The hash inside is the same, so drop the prefix.
  return { data: JSON.parse(text) as T, etag: res.blob.etag.replace(/^W\//, "") };
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
    const { data, etag } = await readDoc(name, empty);
    const out = await mutate(structuredClone(data));
    try {
      await put(path(name), JSON.stringify(out.data), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        // New doc: refuse to overwrite one that appeared meanwhile. Existing doc: only if unchanged since we read it.
        ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
      });
      return out.result;
    } catch (e) {
      if (!isConflict(e) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
    }
  }
  throw new Error("unreachable");
}
