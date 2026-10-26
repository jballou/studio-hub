// Domain types shared by the mock adapter and (later) the Drizzle-backed one.
// Anchor coordinates are normalized 0-1 so they survive any render size.

export type Role = "creative" | "requester";

export type User = {
  id: string;
  name: string;
  initials: string;
  role: Role;
};

export type DotAnchor = { kind: "dot"; x: number; y: number };
export type BoxAnchor = { kind: "box"; x: number; y: number; w: number; h: number };
export type Anchor = DotAnchor | BoxAnchor;

export type AssetKind = "image" | "video" | "audio" | "pdf" | "embed";
export type SourceKind = "figma" | "staging" | "drive" | "slides" | "upload";
export type Device = "desktop" | "mobile";

export type AssetSource = { kind: SourceKind; url: string; label: string };

export type Asset = {
  id: string;
  projectKey: string; // Jira key, e.g. MKTGCRTV-123
  name: string;
  kind: AssetKind;
  versionIds: string[];
  /** where the asset came from; absent for seed data */
  source?: AssetSource;
  reviewerIds?: string[];
  dueDate?: string;
  /** what the creative wants feedback on */
  instructions?: string;
  submittedBy?: string;
};

export type AssetVersion = {
  id: string;
  assetId: string;
  number: number;
  src: string;
  /** width / height; used to fit the stage before media metadata loads */
  aspect: number;
  /** iframe src for link-based assets (Figma, Slides, Drive, staging) */
  embedUrl?: string;
  /** natural width in px that zoom percentages are relative to (link-based assets) */
  baseWidth?: number;
};

export type SubmitInput = {
  source: AssetSource;
  assetKind: AssetKind;
  src: string;
  embedUrl?: string;
  aspect: number;
  baseWidth?: number;
  title: string;
  projectKey: string;
  /** add a new version to this asset instead of creating one */
  existingAssetId: string | null;
  reviewerIds: string[];
  dueDate: string;
  instructions: string;
  submittedBy: string;
};

export type Comment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type JiraPush = { commentId: string; pushedAt: string };

export type Thread = {
  id: string;
  /** per-version pin number shown on canvas and in the panel */
  number: number;
  versionId: string;
  anchor: Anchor | null;
  timeMs: number | null;
  endMs: number | null;
  page: number | null;
  status: "open" | "resolved";
  authorId: string;
  createdAt: string;
  comments: Comment[];
  jira: JiraPush | null;
  pushError: string | null;
};

export type NewThread = {
  versionId: string;
  authorId: string;
  body: string;
  anchor: Anchor | null;
  timeMs: number | null;
  page: number | null;
};

// Requester-facing stages mapped from Jira status.
export type Stage = "Submitted" | "In review" | "In progress" | "In feedback" | "Delivered";
export type ProjectGroup = "open" | "ideas" | "closed";
export type ProjectType = "Social" | "Video" | "Print" | "Web" | "Graphic" | "Copy" | "Campaign" | "Other";

export type Project = {
  id: string;
  jiraKey: string;
  title: string;
  group: ProjectGroup;
  stage: Stage;
  type: ProjectType;
  requesterId: string;
  collaboratorIds: string[];
  deadline: string; // YYYY-MM-DD
  actionRequired: boolean;
  /** comments added since the viewer last opened the project */
  newComments: number;
  /** asset ids for thumbnail strip */
  assetIds: string[];
  /** YYYY-MM-DD the brief was submitted */
  submittedAt: string;
  brief?: Partial<BriefInput>;
  /** plain-text ticket description when there is no structured brief (Jira data) */
  description?: string;
  requesterName?: string;
  collaboratorNames?: string[];
};

export type BriefInput = {
  title: string;
  problem: string;
  opportunity: string;
  scope: string;
  requirements: string;
  antiGoals: string;
  deliverables: string;
  northStar: string;
  openQuestions: string;
  deadline: string;
  assetTypes: ProjectType[];
  stakeholderIds: string[];
};
