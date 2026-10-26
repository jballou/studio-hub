export type ItemType = "social" | "campaign" | "pr" | "event" | "product" | "other";

export const ITEM_TYPES: { id: ItemType; label: string }[] = [
  { id: "social", label: "Social post" },
  { id: "campaign", label: "Campaign launch" },
  { id: "pr", label: "PR" },
  { id: "event", label: "Event" },
  { id: "product", label: "Product launch" },
  { id: "other", label: "Other" },
];

export const STATUSES = ["Idea", "Drafting", "Needs Review", "Scheduled", "Published"] as const;
export type CalStatus = (typeof STATUSES)[number];

export type CalendarItem = {
  id: string;
  type: ItemType;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  endDate?: string;
  /** minutes after midnight */
  time?: number | null;
  status: CalStatus;
  /** true when the source has no status column and we inferred it from dates */
  statusDerived: boolean;
  owner: string;
  campaign: string;
  channel?: string;
  description: string;
  /** secondary date, e.g. creative due */
  dueDate?: string;
  link?: string;
  jiraKey?: string;
  sourceId: string;
  sourceName: string;
  /** human reference to where this came from, e.g. "Row 14" or "MKTGCRTV-12" */
  sourceRef: string;
};

export type CalendarSource = {
  id: string;
  name: string;
  kind: "sheet" | "jira";
  /** type given to every row unless the sheet has its own category column */
  defaultType: ItemType;
  /** sheet: share/export URL */
  url?: string;
  /** pasted CSV, for sheets that can't be fetched */
  csv?: string;
  /** jira: JQL and the field holding the date (not connected yet) */
  jql?: string;
  dateField?: string;
  builtin?: boolean;
};

export type SourceResult = {
  sourceId: string;
  items: CalendarItem[];
  warnings: string[];
  error?: string;
  loadedAt: string;
};
