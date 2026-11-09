// Shapes for a person's private notes and weekly reports. Nothing here is shared with anyone else.

export type NoteType = "win" | "loss" | "blocker" | "opportunity" | "growth" | "one_on_one" | "gig" | "other";
/** "private" stays with the author. "share" marks items the author is willing to put in team-level views (not used for anything yet). */
export type NoteVisibility = "private" | "share";

export type Note = {
  id: string;
  type: NoteType;
  text: string;
  /** ISO timestamp */
  at: string;
  visibility: NoteVisibility;
  /** Set by the KR picker (step 3). */
  krId?: string;
  jiraKey?: string;
  source: "manual" | "interview";
};

export type ReportStatus = "draft" | "final";

/** Mirrors the MarCo weekly columns, plus the themes the monthly and quarterly rollups read. */
export type ReportBody = {
  kpis: string;
  whyItMoved: string;
  owedThisWeek: string;
  blockers: string;
  discussionTopics: string;
  nextSteps: string;
  themes: string[];
  wins: string[];
  losses: string[];
  opportunities: string[];
};

export type Report = {
  /** Monday of the week, YYYY-MM-DD */
  weekStart: string;
  status: ReportStatus;
  body: ReportBody;
  createdAt: string;
  updatedAt: string;
};

export type ReportIndexEntry = { weekStart: string; status: ReportStatus; updatedAt: string };
