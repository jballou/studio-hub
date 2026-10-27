// Domain types shared by the mock adapter and (later) the Drizzle-backed one.
// Anchor coordinates are normalized 0-1 so they survive any render size.

/** Someone you can pick: a Jira account in real mode, a demo user in mock mode. */
export type Person = { id: string; name: string; email?: string };

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
  reviewers?: Person[];
  /** exact deadline as a UTC instant (ISO), shown in dueTz */
  dueAt?: string;
  dueTz?: string;
  /** people who can mark this approved; everyone else can only comment or ask for changes */
  approvers?: Person[];
  /** what the creative wants feedback on */
  instructions?: string;
  submittedBy?: string;
  /** set when this was sent together with other items; items of one batch share an id */
  batch?: { id: string; title: string; index: number; total: number };
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
  reviewers: Person[];
  dueAt: string;
  dueTz: string;
  approvers: Person[];
  instructions: string;
  submittedBy: string;
  batch?: { id: string; title: string; index: number; total: number };
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
/** Who a ticket is blocked by. Jira has no field for this, so the app keeps it. */
export type Block = {
  key: string;
  blockedBy: Person;
  reason: string;
  since: string;
  setBy: string;
  status: "active" | "resolved";
  resolvedAt?: string;
  resolvedBy?: string;
  note?: string;
  /** The Jira status the ticket had before it was blocked, so clearing the block can put it back. */
  previousStatus?: string;
};

/** What happened in Jira when a block was set or cleared. The block itself is always saved. */
export type JiraSync = { ok: true; changed: boolean; status?: string } | { ok: false; reason: string };

/** Jira statuses that need attention without being a stage. */
export type ProjectFlag = "blocked" | "at-risk" | "on-hold" | "needs-info";

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
  flag?: ProjectFlag;
  /** Jira's own status name (real data only), e.g. "In Progress" */
  statusName?: string;
  /** Jira's category for that status: to do / in progress / done */
  statusCategory?: "new" | "indeterminate" | "done";
  /** YYYY-MM-DD work starts. "" means not set; undefined means start dates aren't tracked here. */
  startDate?: string;
  /** YYYY-MM-DD Jira resolved the ticket (real data, closed tickets only) */
  resolvedAt?: string;
  /** brief as labelled sections, from the wizard */
  briefSections?: { label: string; value: string }[];
  /** plain-text ticket description when there is no structured brief (Jira data) */
  description?: string;
  requesterName?: string;
  collaboratorNames?: string[];
};

/** What the conversational wizard produces. Questions are data, so this carries labelled sections rather than fixed fields. */
export type BriefSubmission = {
  /** Jira issue type to create, from the answer to the "type" question. */
  issueTypeId?: string;
  typeLabel: string;
  title: string;
  /** YYYY-MM-DD, from the "deadline" question when asked */
  deadline?: string;
  stakeholders: Person[];
  /** Everything else, in the order it was asked. Becomes the ticket description. */
  sections: { label: string; value: string }[];
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

/** A to-do the person made for themselves. Lives in this app and is backed up to Google Tasks; never written to Jira. */
export type PersonalTask = {
  id: string;
  title: string;
  notes?: string;
  /** YYYY-MM-DD in the person's own time zone */
  date?: string;
  /** HH:MM, 24-hour, in `tz` */
  time?: string;
  /** IANA zone the date and time were entered in */
  tz?: string;
  done: boolean;
  /** Board column while not done. Tasks have no workflow, so this is just where the person parked it. */
  lane?: "todo" | "progress" | "review";
  doneAt?: string;
  createdAt: string;
  updatedAt: string;
  /** "synced" = copy is in Google Tasks; "pending" = last attempt failed, will retry; "off" = Google not connected */
  backup: "synced" | "pending" | "off";
};
