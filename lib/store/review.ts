// Review data on the Blob document store: submissions (assets and their versions) and comment threads.
// Assets and versions share one small document; threads get one document per version so a busy review
// doesn't make everyone rewrite the same file. Every write is conditional (see doc.ts), so two people
// commenting at once both land.
import type { Anchor, Asset, ShareChange, AssetKind, AssetVersion, Person, ReviewState, SourceKind, SubmitInput, Thread } from "@/lib/types";
import { del } from "@vercel/blob";
import { readDoc, updateDoc } from "./doc";
import { AdminError } from "./users";

type AssetsDoc = { assets: Asset[]; versions: AssetVersion[] };
type ThreadsDoc = { threads: Thread[] };
const emptyAssets = (): AssetsDoc => ({ assets: [], versions: [] });
const emptyThreads = (): ThreadsDoc => ({ threads: [] });
const threadsName = (versionId: string) => `review-threads-${versionId}`;
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export type Actor = { accountId: string; name: string; email: string; role: "creative" | "requester" };

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const KINDS: AssetKind[] = ["image", "video", "audio", "pdf", "embed"];
const SOURCES: SourceKind[] = ["figma", "staging", "drive", "slides", "lottie", "upload"];
export const FILE_PREFIX = "/api/review/file/";

const bad = (m: string) => new AdminError(400, m);
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const httpsUrl = (v: unknown, what: string, allowEmpty = true): string => {
  const t = String(v ?? "").trim();
  if (!t) { if (allowEmpty) return ""; throw bad(`Missing ${what}.`); }
  let u: URL;
  try { u = new URL(t); } catch { throw bad(`${what} isn't a link.`); }
  if (u.protocol !== "https:") throw bad(`${what} must start with https://.`);
  return t.slice(0, 2000);
};
const people = (v: unknown): Person[] =>
  (Array.isArray(v) ? v : []).slice(0, 50).map((p) => ({ id: str(p?.id, 80), name: str(p?.name, 120), email: p?.email ? str(p.email, 200) : undefined })).filter((p) => p.id && p.name);

/** A person can open an asset if they sent it, are named on it, or are on the creative team. */
export function canSee(a: Asset, who: Actor): boolean {
  if (a.deletedAt) return false;
  return who.role === "creative" || !!a.linkAccess || a.submittedBy === who.accountId || !!a.reviewers?.some((p) => p.id === who.accountId) || !!a.approvers?.some((p) => p.id === who.accountId);
}

export async function listAssets(who: Actor, projectKey?: string): Promise<Asset[]> {
  const { data } = await readDoc("review-assets", emptyAssets);
  return data.assets.filter((a) => canSee(a, who) && (!projectKey || a.projectKey === projectKey));
}

export async function getAsset(who: Actor, id: string): Promise<{ asset: Asset; versions: AssetVersion[] } | null> {
  const { data } = await readDoc("review-assets", emptyAssets);
  const asset = data.assets.find((a) => a.id === id);
  if (!asset || !canSee(asset, who)) return null;
  return { asset, versions: data.versions.filter((v) => v.assetId === id) };
}

export function validateSubmission(raw: unknown): Omit<SubmitInput, "submittedBy"> {
  const b = (raw ?? {}) as Partial<SubmitInput>;
  const title = str(b.title, 200);
  if (!title) throw bad("Give it a title.");
  const projectKey = str(b.projectKey, 40).toUpperCase();
  if (!KEY_RE.test(projectKey)) throw bad("Choose a Jira ticket.");
  if (!b.assetKind || !KINDS.includes(b.assetKind)) throw bad("Unknown kind of file.");
  const kind = (b.source?.kind ?? "") as SourceKind;
  if (!SOURCES.includes(kind)) throw bad("Unknown source.");
  const src = String(b.src ?? "");
  // Uploaded files live in our store; Drive streams are external https links; embeds have none.
  if (src && !(src.startsWith(FILE_PREFIX) && src.length < 400 && !src.includes("..")) && !/^https:\/\//.test(src)) throw bad("That file link isn't allowed.");
  if (src.startsWith("https://")) httpsUrl(src, "The file link");
  const embedUrl = httpsUrl(b.embedUrl, "The preview link") || undefined;
  if (b.assetKind === "embed" && !embedUrl) throw bad("Add a link to preview.");
  if (b.assetKind !== "embed" && !src) throw bad("Add a file.");
  const aspect = Number(b.aspect);
  if (!(aspect > 0.05 && aspect < 20)) throw bad("Bad frame shape.");
  const dueAt = new Date(String(b.dueAt)).toString() === "Invalid Date" ? "" : new Date(String(b.dueAt)).toISOString();
  if (!dueAt) throw bad("Add a due date and time.");
  const reviewers = people(b.reviewers);
  const approvers = people(b.approvers);
  if (!reviewers.length || !approvers.length) throw bad("Choose at least one reviewer and one approver.");
  const batch = b.batch && ID_RE.test(String(b.batch.id)) ? { id: String(b.batch.id), title: str(b.batch.title, 200), index: Math.max(0, Math.floor(Number(b.batch.index) || 0)), total: Math.max(1, Math.floor(Number(b.batch.total) || 1)) } : undefined;
  const existing = b.existingAssetId ? str(b.existingAssetId, 64) : null;
  if (existing && !ID_RE.test(existing)) throw bad("Unknown design.");
  return {
    source: { kind, url: kind === "upload" ? "" : httpsUrl(b.source?.url, "The link"), label: str(b.source?.label, 300) },
    assetKind: b.assetKind, src, embedUrl, aspect, baseWidth: b.baseWidth ? Math.min(8000, Math.max(100, Number(b.baseWidth) || 1280)) : undefined,
    title, projectKey, existingAssetId: existing, reviewers, dueAt, dueTz: str(b.dueTz, 64) || "UTC", approvers,
    instructions: str(b.instructions, 2000), batch,
  };
}

export async function submit(who: Actor, input: Omit<SubmitInput, "submittedBy">): Promise<{ assetId: string; versionId: string }> {
  const versionId = uuid();
  const assetId = await updateDoc("review-assets", emptyAssets, (d) => {
    let asset = input.existingAssetId ? d.assets.find((a) => a.id === input.existingAssetId) : undefined;
    if (input.existingAssetId && !asset) throw new AdminError(404, "That design doesn't exist.");
    if (asset && !canSee(asset, who)) throw new AdminError(403, "You can't add to that design.");
    const number = (asset?.versionIds.length ?? 0) + 1;
    if (asset) {
      asset.versionIds.push(versionId);
      asset.reviewers = input.reviewers; asset.approvers = input.approvers;
      asset.dueAt = input.dueAt; asset.dueTz = input.dueTz; asset.instructions = input.instructions;
      asset.review = "awaiting";
    } else {
      asset = {
        id: uuid(), projectKey: input.projectKey, name: input.title, kind: input.assetKind, versionIds: [versionId], source: input.source,
        reviewers: input.reviewers, approvers: input.approvers, dueAt: input.dueAt, dueTz: input.dueTz, instructions: input.instructions,
        submittedBy: who.accountId, batch: input.batch, review: "awaiting",
      };
      d.assets.push(asset);
    }
    d.versions.push({ id: versionId, assetId: asset.id, number, src: input.src, aspect: input.aspect, embedUrl: input.embedUrl, baseWidth: input.baseWidth });
    return { data: d, result: asset.id };
  });
  return { assetId, versionId };
}

/** Adding people, removing people and the link setting: the sender, the creative team or a named approver. */
export async function updateSharing(who: Actor, assetId: string, change: ShareChange): Promise<Asset> {
  const add = (Array.isArray(change.add) ? change.add : []).slice(0, 30).map((x) => ({ person: people([x?.person])[0], role: x?.role === "approver" ? ("approver" as const) : ("reviewer" as const) })).filter((x) => x.person);
  const remove = (Array.isArray(change.remove) ? change.remove : []).slice(0, 60).map((x) => str(x, 80));
  return updateDoc("review-assets", emptyAssets, (d) => {
    const a = d.assets.find((x) => x.id === assetId);
    if (!a || !canSee(a, who)) throw new AdminError(404, "That design doesn't exist.");
    const mayShare = who.role === "creative" || a.submittedBy === who.accountId || !!a.approvers?.some((p) => p.id === who.accountId);
    if (!mayShare) throw new AdminError(403, "Only the person who sent this, an approver or the creative team can change who has access.");
    const reviewers = a.reviewers ?? [];
    const approvers = a.approvers ?? [];
    for (const { person, role } of add) {
      if (!reviewers.some((p) => p.id === person.id)) reviewers.push(person);
      if (role === "approver" && !approvers.some((p) => p.id === person.id)) approvers.push(person);
    }
    if (remove.length) {
      // The last approver stays: someone has to be able to sign off.
      const keepApprovers = approvers.filter((p) => !remove.includes(p.id));
      if (!keepApprovers.length) throw bad("Keep at least one approver.");
      a.approvers = keepApprovers;
      a.reviewers = reviewers.filter((p) => !remove.includes(p.id));
    } else { a.reviewers = reviewers; a.approvers = approvers; }
    if (typeof change.linkAccess === "boolean") a.linkAccess = change.linkAccess;
    return { data: d, result: a };
  });
}

/** Asking for changes: the submitter, reviewers or creative team. Approving: only the named approvers. */
export async function setReviewState(who: Actor, assetId: string, state: ReviewState): Promise<Asset> {
  if (!["awaiting", "changes", "approved"].includes(state)) throw bad("Unknown status.");
  return updateDoc("review-assets", emptyAssets, (d) => {
    const a = d.assets.find((x) => x.id === assetId);
    if (!a || !canSee(a, who)) throw new AdminError(404, "That design doesn't exist.");
    if (state === "approved" && !a.approvers?.some((p) => p.id === who.accountId)) throw new AdminError(403, "Only the people named as approvers can approve this.");
    a.review = state;
    return { data: d, result: a };
  });
}

async function assertVersionVisible(who: Actor, versionId: string): Promise<{ asset: Asset; version: AssetVersion }> {
  if (!ID_RE.test(versionId)) throw new AdminError(404, "Not found.");
  const { data } = await readDoc("review-assets", emptyAssets);
  const version = data.versions.find((v) => v.id === versionId);
  const asset = version && data.assets.find((a) => a.id === version.assetId);
  if (!version || !asset || !canSee(asset, who)) throw new AdminError(404, "Not found.");
  return { asset, version };
}

export async function listThreads(who: Actor, versionId: string): Promise<Thread[]> {
  await assertVersionVisible(who, versionId);
  return (await readDoc(threadsName(versionId), emptyThreads)).data.threads;
}

const validAnchor = (a: unknown): Anchor | null => {
  const x = a as Partial<Anchor> | null;
  if (!x || typeof x !== "object") return null;
  const n = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 1 ? v : null);
  if (x.kind === "dot" && n(x.x) !== null && n(x.y) !== null) return { kind: "dot", x: x.x!, y: x.y! };
  if (x.kind === "box") { const b = x as { x: number; y: number; w: number; h: number }; if ([b.x, b.y, b.w, b.h].every((v) => n(v) !== null)) return { kind: "box", x: b.x, y: b.y, w: b.w, h: b.h }; }
  return null;
};

export async function createThread(who: Actor, input: { versionId: string; body: string; anchor: unknown; timeMs: unknown; page: unknown }): Promise<Thread> {
  await assertVersionVisible(who, input.versionId);
  const body = str(input.body, 5000);
  if (!body) throw bad("Write a comment first.");
  const timeMs = typeof input.timeMs === "number" && input.timeMs >= 0 ? Math.round(input.timeMs) : null;
  const page = typeof input.page === "number" && input.page >= 1 ? Math.floor(input.page) : null;
  return updateDoc(threadsName(input.versionId), emptyThreads, (d) => {
    const t: Thread = {
      id: uuid(), number: Math.max(0, ...d.threads.map((x) => x.number)) + 1, versionId: input.versionId, anchor: validAnchor(input.anchor),
      timeMs, endMs: null, page, status: "open", authorId: who.accountId, createdAt: now(),
      comments: [{ id: uuid(), authorId: who.accountId, authorName: who.name, authorRole: who.role, body, createdAt: now() }],
      jira: null, pushError: null,
    };
    d.threads.push(t);
    return { data: d, result: t };
  });
}

type ThreadOp =
  | { op: "reply"; body: string }
  | { op: "status"; status: "open" | "resolved" }
  | { op: "anchor"; anchor: unknown };

/** Resolve and move-the-pin are for the creative team and the comment's author; anyone who can see it may reply. */
export async function changeThread(who: Actor, versionId: string, threadId: string, change: ThreadOp): Promise<Thread> {
  await assertVersionVisible(who, versionId);
  return updateDoc(threadsName(versionId), emptyThreads, (d) => {
    const t = d.threads.find((x) => x.id === threadId);
    if (!t) throw new AdminError(404, "That comment doesn't exist.");
    const own = who.role === "creative" || t.authorId === who.accountId;
    if (change.op === "reply") {
      const body = str(change.body, 5000);
      if (!body) throw bad("Write a reply first.");
      t.comments.push({ id: uuid(), authorId: who.accountId, authorName: who.name, authorRole: who.role, body, createdAt: now() });
    } else if (change.op === "status") {
      if (!own) throw new AdminError(403, "Only the creative team or the person who wrote it can resolve this.");
      if (change.status !== "open" && change.status !== "resolved") throw bad("Unknown status.");
      t.status = change.status;
    } else {
      if (!own) throw new AdminError(403, "Only the creative team or the person who wrote it can move this.");
      const a = validAnchor(change.anchor);
      if (!a) throw bad("Bad pin position.");
      t.anchor = a;
    }
    return { data: d, result: t };
  });
}

export async function getThreadForPush(who: Actor, versionId: string, threadId: string): Promise<{ thread: Thread; asset: Asset; version: AssetVersion }> {
  const { asset, version } = await assertVersionVisible(who, versionId);
  const t = (await readDoc(threadsName(versionId), emptyThreads)).data.threads.find((x) => x.id === threadId);
  if (!t) throw new AdminError(404, "That comment doesn't exist.");
  if (who.role !== "creative" && t.authorId !== who.accountId) throw new AdminError(403, "You can only push your own comments.");
  return { thread: t, asset, version };
}

export async function recordPush(versionId: string, threadId: string, result: { commentId: string } | { error: string }): Promise<Thread> {
  return updateDoc(threadsName(versionId), emptyThreads, (d) => {
    const t = d.threads.find((x) => x.id === threadId);
    if (!t) throw new AdminError(404, "That comment doesn't exist.");
    if ("commentId" in result) { t.jira = { commentId: result.commentId, pushedAt: now() }; t.pushError = null; }
    else if (!t.jira) t.pushError = result.error;
    return { data: d, result: t };
  });
}

// ---- Trash ----
export const TRASH_DAYS = 30;
const DAY_MS = 86_400_000;
const isExpired = (a: Asset, nowMs = Date.now()) => !!a.deletedAt && nowMs - Date.parse(a.deletedAt) >= TRASH_DAYS * DAY_MS;

/** Moves a design to Trash. The sender, the creative team or a named approver may; everything stays intact for restoring. */
export async function moveToTrash(who: Actor, assetId: string): Promise<Asset> {
  return updateDoc("review-assets", emptyAssets, (d) => {
    const a = d.assets.find((x) => x.id === assetId);
    if (!a || !canSee(a, who)) throw new AdminError(404, "That design doesn't exist.");
    const may = who.role === "creative" || a.submittedBy === who.accountId || !!a.approvers?.some((p) => p.id === who.accountId);
    if (!may) throw new AdminError(403, "Only the person who sent this, an approver or the creative team can delete it.");
    a.deletedAt = now();
    a.deletedBy = { id: who.accountId, name: who.name };
    return { data: d, result: a };
  });
}

/** What is in Trash, newest first. Creative team and admins only (the route checks). */
export async function listTrash(): Promise<(Asset & { daysLeft: number })[]> {
  const { data } = await readDoc("review-assets", emptyAssets);
  return data.assets
    .filter((a) => a.deletedAt)
    .sort((x, y) => (y.deletedAt ?? "").localeCompare(x.deletedAt ?? ""))
    .map((a) => ({ ...a, daysLeft: Math.max(0, Math.ceil((Date.parse(a.deletedAt!) + TRASH_DAYS * DAY_MS - Date.now()) / DAY_MS)) }));
}

export async function restoreFromTrash(assetId: string): Promise<Asset> {
  return updateDoc("review-assets", emptyAssets, (d) => {
    const a = d.assets.find((x) => x.id === assetId);
    if (!a?.deletedAt) throw new AdminError(404, "That isn't in Trash anymore.");
    if (isExpired(a)) throw new AdminError(410, "That was past 30 days in Trash and has been removed.");
    delete a.deletedAt; delete a.deletedBy;
    return { data: d, result: a };
  });
}

/** Removes designs for good: their records, comments and uploaded files. `ids` limits it; otherwise everything past 30 days. */
export async function purge(opts: { ids?: string[]; expiredOnly: boolean }): Promise<number> {
  const removed = await updateDoc("review-assets", emptyAssets, (d) => {
    const gone = d.assets.filter((a) => a.deletedAt && (opts.expiredOnly ? isExpired(a) : true) && (!opts.ids || opts.ids.includes(a.id)));
    const goneIds = new Set(gone.map((a) => a.id));
    const vs = d.versions.filter((v) => goneIds.has(v.assetId));
    d.assets = d.assets.filter((a) => !goneIds.has(a.id));
    d.versions = d.versions.filter((v) => !goneIds.has(v.assetId));
    return { data: d, result: vs };
  });
  // Files and comment documents go after the records, best effort: an orphan file is harmless, a dangling record is not.
  const paths: string[] = [];
  for (const v of removed) {
    paths.push(`${process.env.VERCEL_ENV ?? "local"}/${threadsName(v.id)}.json`);
    if (v.src.startsWith(FILE_PREFIX)) paths.push(`review-files/${v.src.slice(FILE_PREFIX.length).split("/").map(decodeURIComponent).join("/")}`);
  }
  if (paths.length) await del(paths).catch(() => undefined);
  return new Set(removed.map((v) => v.assetId)).size;
}
