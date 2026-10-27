import type { ReviewRepo } from "./repo";
import { isJira } from "./mode";
import type { Anchor, Asset, ReviewState, AssetVersion, NewThread, SubmitInput, Thread, User } from "@/lib/types";

const users: User[] = [
  { id: "u-avery", name: "Avery Chen", initials: "AC", role: "creative" },
  { id: "u-sam", name: "Sam Okafor", initials: "SO", role: "creative" },
  { id: "u-riley", name: "Riley Brooks", initials: "RB", role: "requester" },
  { id: "u-jordan", name: "Jordan Patel", initials: "JP", role: "requester" },
];

const assets: Asset[] = [
  { id: "a-ad", projectKey: "MKTGCRTV-101", name: "Spring campaign: social ad", kind: "image", versionIds: ["v-ad-1", "v-ad-2"], submittedBy: "u-avery", review: "changes", approvers: [{ id: "u-riley", name: "Riley Brooks" }] },
  { id: "a-video", projectKey: "MKTGCRTV-102", name: "Product teaser (15s)", kind: "video", versionIds: ["v-video-1"], submittedBy: "u-avery", review: "awaiting", approvers: [{ id: "u-riley", name: "Riley Brooks" }] },
  { id: "a-pdf", projectKey: "MKTGCRTV-103", name: "Brand one-pager", kind: "pdf", versionIds: ["v-pdf-1"], submittedBy: "u-avery", review: "approved", approvers: [{ id: "u-jordan", name: "Jordan Patel" }] },
];

const versions: AssetVersion[] = [
  { id: "v-ad-1", assetId: "a-ad", number: 1, src: "/samples/ad-v1.svg", aspect: 1 },
  { id: "v-ad-2", assetId: "a-ad", number: 2, src: "/samples/ad-v2.svg", aspect: 1 },
  { id: "v-video-1", assetId: "a-video", number: 1, src: "/samples/teaser.mp4", aspect: 16 / 9 },
  { id: "v-pdf-1", assetId: "a-pdf", number: 1, src: "/samples/one-pager.pdf", aspect: 8.5 / 11 },
];

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

// Module-level state: survives navigation within a session, resets on reload.
const threads: Thread[] = [
  {
    id: "t1", number: 1, versionId: "v-ad-1", anchor: { kind: "dot", x: 0.5, y: 0.2 },
    timeMs: null, endMs: null, page: null, status: "open", authorId: "u-riley", createdAt: iso(90),
    comments: [{ id: "c1", authorId: "u-riley", body: "Can the headline be larger? It gets lost on mobile.", createdAt: iso(90) }],
    jira: null, pushError: null,
  },
  {
    id: "t2", number: 2, versionId: "v-ad-1", anchor: { kind: "box", x: 0.3, y: 0.65, w: 0.4, h: 0.15 },
    timeMs: null, endMs: null, page: null, status: "resolved", authorId: "u-jordan", createdAt: iso(60),
    comments: [
      { id: "c2", authorId: "u-jordan", body: "CTA button color is off-brand.", createdAt: iso(60) },
      { id: "c3", authorId: "u-avery", body: "Fixed in this pass, thanks.", createdAt: iso(40) },
    ],
    jira: { commentId: "jira-10001", pushedAt: iso(35) }, pushError: null,
  },
  {
    id: "t3", number: 1, versionId: "v-pdf-1", anchor: { kind: "dot", x: 0.4, y: 0.3 },
    timeMs: null, endMs: null, page: 1, status: "open", authorId: "u-sam", createdAt: iso(30),
    comments: [{ id: "c4", authorId: "u-sam", body: "@Riley Brooks please confirm this tagline with legal.", createdAt: iso(30) }],
    jira: null, pushError: null,
  },
  {
    id: "t4", number: 1, versionId: "v-video-1", anchor: { kind: "dot", x: 0.5, y: 0.5 },
    timeMs: 2000, endMs: null, page: null, status: "open", authorId: "u-riley", createdAt: iso(20),
    comments: [{ id: "c5", authorId: "u-riley", body: "Logo animation feels slow here.", createdAt: iso(20) }],
    jira: null, pushError: null,
  },
];

// Real mode starts empty: the seeded demo assets and comments refer to tickets and people that don't exist.
if (isJira) { assets.length = 0; versions.length = 0; threads.length = 0; }

let seq = 100;
const nid = (p: string) => `${p}${++seq}`;
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 40));

function must(id: string): Thread {
  const t = threads.find((x) => x.id === id);
  if (!t) throw new Error(`thread ${id} not found`);
  return t;
}

export const mockControls = { simulatePushFailure: false };

export const mockRepo: ReviewRepo = {
  // Real mode has no demo people; names come from Jira user search and the signed-in account.
  listUsers: () => delay(isJira ? [] : users),
  listAssets: () => delay(assets),
  getAsset: (id) => delay(assets.find((a) => a.id === id) ?? null),
  getVersion: (id) => delay(versions.find((v) => v.id === id) ?? null),
  listThreads: (versionId) => delay(threads.filter((t) => t.versionId === versionId)),

  createThread(input: NewThread) {
    const number = Math.max(0, ...threads.filter((t) => t.versionId === input.versionId).map((t) => t.number)) + 1;
    const now = new Date().toISOString();
    const t: Thread = {
      id: nid("t"), number, versionId: input.versionId, anchor: input.anchor,
      timeMs: input.timeMs, endMs: null, page: input.page, status: "open",
      authorId: input.authorId, createdAt: now,
      comments: [{ id: nid("c"), authorId: input.authorId, body: input.body, createdAt: now }],
      jira: null, pushError: null,
    };
    threads.push(t);
    return delay(t);
  },

  reply(threadId, authorId, body) {
    const t = must(threadId);
    t.comments.push({ id: nid("c"), authorId, body, createdAt: new Date().toISOString() });
    return delay(t);
  },

  setStatus(threadId, status) {
    const t = must(threadId);
    t.status = status;
    return delay(t);
  },

  updateAnchor(threadId, anchor: Anchor) {
    const t = must(threadId);
    t.anchor = anchor;
    return delay(t);
  },

  async submitForReview(input: SubmitInput) {
    let asset = input.existingAssetId ? assets.find((a) => a.id === input.existingAssetId) : undefined;
    const number = asset ? asset.versionIds.length + 1 : 1;
    const versionId = nid("v-");
    versions.push({
      id: versionId, assetId: asset?.id ?? "", number, src: input.src, aspect: input.aspect, embedUrl: input.embedUrl, baseWidth: input.baseWidth,
    });
    if (asset) {
      asset.versionIds.push(versionId);
      asset.reviewers = input.reviewers;
      asset.dueAt = input.dueAt;
      asset.dueTz = input.dueTz;
      asset.approvers = input.approvers;
      asset.instructions = input.instructions;
      asset.review = "awaiting";
    } else {
      asset = {
        id: nid("a-"), projectKey: input.projectKey, name: input.title, kind: input.assetKind, versionIds: [versionId],
        source: input.source, reviewers: input.reviewers, dueAt: input.dueAt, dueTz: input.dueTz, approvers: input.approvers,
        instructions: input.instructions, submittedBy: input.submittedBy, batch: input.batch, review: "awaiting",
      };
      assets.push(asset);
    }
    versions[versions.length - 1].assetId = asset.id;
    return delay({ assetId: asset.id, versionId });
  },

  setReviewState(assetId: string, state: ReviewState) {
    const a = assets.find((x) => x.id === assetId);
    if (!a) throw new Error(`asset ${assetId} not found`);
    a.review = state;
    return delay(a);
  },

  async pushToJira(threadId, actorId) {
    const t = must(threadId);
    if (t.jira) return structuredClone(t); // never duplicate on re-push
    const actor = users.find((u) => u.id === actorId);
    const allowed = actor?.role === "creative" || t.authorId === actorId;
    if (!allowed) {
      t.pushError = "You can only push your own comments.";
    } else if (mockControls.simulatePushFailure) {
      t.pushError = "Jira rejected the comment (token expired or ticket restricted).";
    } else {
      t.pushError = null;
      t.jira = { commentId: nid("jira-"), pushedAt: new Date().toISOString() };
    }
    return delay(t);
  },
};
