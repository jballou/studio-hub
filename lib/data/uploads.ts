import { mimeOf } from "@/lib/media";

/**
 * Sends a file to the Hub in chunks (so each request stays small) and returns the URL reviewers will open.
 * `onProgress` gets 0..1. Throws an Error with a plain message; aborting through `signal` throws an AbortError.
 */
export async function uploadReviewFile(file: File, onProgress: (p: number) => void, signal: AbortSignal): Promise<{ url: string }> {
  const api = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { ...init, signal, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status}).`);
    return body;
  };
  const meta = await api("/api/review/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, type: mimeOf(file), size: file.size }) });
  const sent = new Array<number>(meta.chunks).fill(0);
  const report = () => onProgress(Math.min(1, sent.reduce((a, b) => a + b, 0) / file.size));
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= meta.chunks) return;
      const part = file.slice(i * meta.chunkBytes, (i + 1) * meta.chunkBytes);
      for (let attempt = 0; ; attempt++) {
        try {
          await api(`/api/review/files/${meta.id}?i=${i}`, { method: "PUT", body: part });
          break;
        } catch (e) {
          if (signal.aborted || attempt >= 2) throw e;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      sent[i] = part.size;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, meta.chunks) }, worker));
  return api(`/api/review/files/${meta.id}`, { method: "POST" });
}
