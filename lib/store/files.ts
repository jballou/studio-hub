// Uploaded review files, stored in the same Upstash Redis as everything else, in chunks.
// Meant for the files this app is used with (images, PDFs, audio, short video). Big videos should be shared as a link.
// Each chunk is base64 text so it fits Redis' string values; a prefix keeps the client from guessing it is JSON.
import { randomUUID } from "node:crypto";
import { MAX_UPLOAD_BYTES } from "@/lib/media";
import { PREFIX, redisClientForFiles, storeKind } from "./doc";
import { AdminError } from "./users";

export const CHUNK_BYTES = 512 * 1024;
export const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;
export const filesAvailable = () => storeKind === "Upstash Redis";

export type FileMeta = { id: string; name: string; type: string; size: number; chunks: number; owner: string; complete: boolean; at: string };

const metaKey = (id: string) => `hub:${PREFIX}file:${id}:meta`;
const chunkKey = (id: string, i: number) => `hub:${PREFIX}file:${id}:${i}`;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const TYPE_RE = /^(image|video|audio)\/[\w.+-]+$|^application\/pdf$/;
const NAME_RE = /[^A-Za-z0-9._ ()+-]/g;

const r = () => redisClientForFiles();
const bad = (m: string, status = 400) => new AdminError(status, m);

export const safeName = (n: string) => n.replace(NAME_RE, "_").slice(-120) || "file";

export async function startUpload(owner: string, input: { name: unknown; type: unknown; size: unknown }): Promise<FileMeta> {
  if (!filesAvailable()) throw bad("File storage isn't set up.", 503);
  const size = Number(input.size);
  if (!(size > 0)) throw bad("That file is empty.");
  if (size > MAX_FILE_BYTES) throw bad(`That file is ${(size / 1e6).toFixed(0)} MB. Uploads are limited to ${MAX_FILE_BYTES / 1024 / 1024} MB for now. For bigger videos, share a link (Google Drive or Figma) instead.`, 413);
  const type = String(input.type ?? "");
  if (!TYPE_RE.test(type)) throw bad("That file type isn't supported. Use an image, video, audio or PDF.");
  const meta: FileMeta = { id: randomUUID(), name: safeName(String(input.name ?? "file")), type, size, chunks: Math.ceil(size / CHUNK_BYTES), owner, complete: false, at: new Date().toISOString() };
  await r().set(metaKey(meta.id), JSON.stringify(meta), { ex: 24 * 3600 }); // an upload that never finishes cleans itself up
  return meta;
}

async function getMeta(id: string): Promise<FileMeta | null> {
  if (!ID_RE.test(id)) return null;
  const raw = await r().get<FileMeta | string>(metaKey(id));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as FileMeta) : raw;
}
export const fileInfo = getMeta;

export async function putChunk(owner: string, id: string, index: number, bytes: Uint8Array): Promise<void> {
  const meta = await getMeta(id);
  if (!meta || meta.owner !== owner || meta.complete) throw bad("That upload isn't open.", 404);
  if (!Number.isInteger(index) || index < 0 || index >= meta.chunks) throw bad("Bad chunk.");
  const expected = index === meta.chunks - 1 ? meta.size - CHUNK_BYTES * (meta.chunks - 1) : CHUNK_BYTES;
  if (bytes.byteLength !== expected) throw bad(`Chunk ${index} is ${bytes.byteLength} bytes, expected ${expected}.`);
  await r().set(chunkKey(id, index), `b64:${Buffer.from(bytes).toString("base64")}`, { ex: 24 * 3600 });
}

/** Checks every chunk arrived, then keeps the file for good (until its design is deleted for good). */
export async function finishUpload(owner: string, id: string): Promise<FileMeta> {
  const meta = await getMeta(id);
  if (!meta || meta.owner !== owner) throw bad("That upload isn't open.", 404);
  const present = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => r().exists(chunkKey(id, i))));
  if (present.some((x) => !x)) throw bad("Some of the file didn't arrive. Try the upload again.");
  const done = { ...meta, complete: true };
  const pipe = r().pipeline();
  pipe.set(metaKey(id), JSON.stringify(done));
  for (let i = 0; i < meta.chunks; i++) pipe.persist(chunkKey(id, i));
  await pipe.exec();
  return done;
}

async function readChunk(id: string, i: number): Promise<Buffer> {
  const raw = await r().get<string>(chunkKey(id, i));
  if (typeof raw !== "string" || !raw.startsWith("b64:")) throw bad("Part of that file is missing.", 404);
  return Buffer.from(raw.slice(4), "base64");
}

/** Bytes start..end (inclusive) as a stream, reading one chunk at a time. */
export function streamRange(meta: FileMeta, start: number, end: number): ReadableStream<Uint8Array> {
  let next = Math.floor(start / CHUNK_BYTES);
  const last = Math.floor(end / CHUNK_BYTES);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (next > last) { controller.close(); return; }
      const i = next++;
      const chunk = await readChunk(meta.id, i);
      const from = i === Math.floor(start / CHUNK_BYTES) ? start - i * CHUNK_BYTES : 0;
      const to = i === last ? end - i * CHUNK_BYTES + 1 : chunk.length;
      controller.enqueue(new Uint8Array(chunk.subarray(from, to)));
    },
  });
}

export async function deleteFile(id: string): Promise<void> {
  const meta = await getMeta(id);
  if (!meta) return;
  const keys = [metaKey(id), ...Array.from({ length: meta.chunks }, (_, i) => chunkKey(id, i))];
  await r().del(...keys);
}
