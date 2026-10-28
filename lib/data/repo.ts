import type { Asset, ReviewState, ShareChange, AssetVersion, Anchor, NewThread, SubmitInput, Thread, User } from "@/lib/types";

/**
 * Data boundary for the review feature. The mock adapter implements this now;
 * the Drizzle/Jira adapter replaces it on Days 3-6 without touching UI code.
 * Authorization (Jira Browse intersection) belongs inside the real adapter.
 */
export interface ReviewRepo {
  listUsers(): Promise<User[]>;
  getAsset(assetId: string): Promise<Asset | null>;
  listAssets(): Promise<Asset[]>;
  getVersion(versionId: string): Promise<AssetVersion | null>;
  listThreads(versionId: string): Promise<Thread[]>;
  createThread(input: NewThread): Promise<Thread>;
  reply(threadId: string, authorId: string, body: string): Promise<Thread>;
  setStatus(threadId: string, status: Thread["status"]): Promise<Thread>;
  updateAnchor(threadId: string, anchor: Anchor): Promise<Thread>;
  /** Creates an asset (or a new version of one) and the feedback request for it. */
  submitForReview(input: SubmitInput): Promise<{ assetId: string; versionId: string }>;
  /** Adds or removes people and sets whether anyone with the link can open it. */
  share(assetId: string, change: ShareChange): Promise<Asset>;
  /** Records the outcome of a review: changes requested or approved. */
  setReviewState(assetId: string, state: ReviewState): Promise<Asset>;
  /** Idempotent: a thread that already has a jira comment id is returned unchanged. */
  pushToJira(threadId: string, actorId: string): Promise<Thread>;
}
