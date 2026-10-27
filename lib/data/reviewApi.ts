import type { Anchor, Asset, AssetVersion, NewThread, ReviewState, SubmitInput, Thread, User } from "@/lib/types";
import type { ReviewRepo } from "./repo";

/** Review data saved on the server (Blob store). Used in real mode; demo mode keeps the in-memory mock. */
const versions = new Map<string, AssetVersion>();
const threadVersion = new Map<string, string>();

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body as T;
}
const post = <T,>(url: string, body: unknown) => call<T>(url, { method: "POST", body: JSON.stringify(body) });

function remember(t: Thread): Thread {
  threadVersion.set(t.id, t.versionId);
  return t;
}
const versionOf = (threadId: string) => {
  const v = threadVersion.get(threadId);
  if (!v) throw new Error("Reload the page and try again.");
  return v;
};

export const apiRepo: ReviewRepo = {
  // People come from Jira search and the names saved on each request or comment, not from a list.
  listUsers: async (): Promise<User[]> => [],
  listAssets: async (): Promise<Asset[]> => (await call<{ assets: Asset[] }>("/api/review/assets")).assets,
  async getAsset(id) {
    try {
      const r = await call<{ asset: Asset; versions: AssetVersion[] }>(`/api/review/assets/${encodeURIComponent(id)}`);
      for (const v of r.versions) versions.set(v.id, v);
      return r.asset;
    } catch {
      return null;
    }
  },
  getVersion: async (id) => versions.get(id) ?? null,
  async listThreads(versionId) {
    return (await call<{ threads: Thread[] }>(`/api/review/threads?versionId=${encodeURIComponent(versionId)}`)).threads.map(remember);
  },
  async createThread(input: NewThread) {
    return remember((await post<{ thread: Thread }>("/api/review/threads", { op: "create", ...input })).thread);
  },
  async reply(threadId, _authorId, body) {
    return remember((await post<{ thread: Thread }>("/api/review/threads", { op: "reply", versionId: versionOf(threadId), threadId, body })).thread);
  },
  async setStatus(threadId, status) {
    return remember((await post<{ thread: Thread }>("/api/review/threads", { op: "status", versionId: versionOf(threadId), threadId, status })).thread);
  },
  async updateAnchor(threadId, anchor: Anchor) {
    return remember((await post<{ thread: Thread }>("/api/review/threads", { op: "anchor", versionId: versionOf(threadId), threadId, anchor })).thread);
  },
  submitForReview: (input: SubmitInput) => post("/api/review/assets", input),
  async setReviewState(assetId, state: ReviewState) {
    return (await call<{ asset: Asset }>(`/api/review/assets/${encodeURIComponent(assetId)}`, { method: "PATCH", body: JSON.stringify({ review: state }) })).asset;
  },
  async pushToJira(threadId) {
    return remember((await post<{ thread: Thread }>("/api/review/threads", { op: "push", versionId: versionOf(threadId), threadId })).thread);
  },
};
