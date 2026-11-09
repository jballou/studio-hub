// A read-only copy of the FY27 OKR Sheet. The Sheet stays the source of truth; the Hub mirrors it.

export type Kr = {
  /** Stable while the objective and KR wording stay the same. Safe for Jira labels (kr-xxxxxxxx). */
  id: string;
  objective: string;
  kr: string;
  owner?: string;
  baseline?: string;
  target?: string;
  current?: string;
  unit?: string;
  status?: string;
  tab: string;
};

export type Initiative = {
  id: string;
  /** Empty when the Sheet row has no KR in or above it. */
  krId?: string;
  objective: string;
  kr: string;
  title: string;
  detail?: string;
  owner?: string;
  successCriteria?: string;
  milestones?: string;
  status?: string;
  tab: string;
};

export type OkrMirror = {
  sourceId: string;
  syncedAt: string;
  syncedBy: string;
  tabs: string[];
  krs: Kr[];
  initiatives: Initiative[];
  /** Things the parser couldn't place, for the admin to fix in the Sheet. */
  warnings: string[];
};

export type OkrConfig = {
  spreadsheetId: string;
  /** Tab names to read, in order. */
  tabs: string[];
};

export type ParsedTab = { krs: Kr[]; initiatives: Initiative[]; warnings: string[] };
