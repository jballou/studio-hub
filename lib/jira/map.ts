import type { CalendarItem, CalStatus, ItemType } from "@/lib/calendar/types";
import type { Project, ProjectFlag, ProjectGroup, ProjectType, Stage } from "@/lib/types";
import { krFromLabels } from "@/lib/okr/label";
import type { JiraIssue } from "./client";

export const PROJECT_KEY = "MKTGCRTV";
/** Jira label put on every ticket created from the Hub's brief wizard. */
export const HUB_LABEL = "brand-hub";

// Real MKTGCRTV statuses seen so far: Intake, Open, In Progress. Extend as the full workflow is confirmed.
const STATUS_TO_STAGE: Record<string, Stage> = {
  intake: "Submitted", open: "Submitted", "to do": "Submitted", backlog: "Submitted", "on hold": "Submitted", "need more info": "Submitted",
  "in review": "In review", scoping: "In review",
  planning: "In progress", "in progress": "In progress", "in design": "In progress", "in production": "In progress", blocked: "In progress", "at risk": "In progress",
  "in feedback": "In feedback", "feedback": "In feedback", "awaiting feedback": "In feedback", "ready for review": "In feedback",
  done: "Delivered", closed: "Delivered", resolved: "Delivered", delivered: "Delivered", complete: "Delivered", completed: "Delivered",
  cancelled: "Delivered", "won't do": "Delivered", duplicate: "Delivered",
};

export function stageOf(issue: JiraIssue): Stage {
  const named = STATUS_TO_STAGE[issue.fields.status.name.toLowerCase()];
  if (named) return named;
  const cat = issue.fields.status.statusCategory.key;
  return cat === "done" ? "Delivered" : cat === "new" ? "Submitted" : "In progress";
}

const TYPE_BY_ISSUETYPE: Record<string, ProjectType> = {
  "graphic production": "Graphic", "video production": "Video", "animation production": "Video",
  "web design/ux": "Web", "copywriting support": "Copy", "campaigns or activations": "Campaign",
};
// Real MKTGCRTV statuses that mean "look at this" but are not a stage of the work.
const FLAG_BY_STATUS: Record<string, ProjectFlag> = {
  blocked: "blocked", "at risk": "at-risk", "on hold": "on-hold", "need more info": "needs-info",
};
export const flagOf = (i: JiraIssue): ProjectFlag | undefined => FLAG_BY_STATUS[i.fields.status.name.toLowerCase()];

export const projectTypeOf = (i: JiraIssue): ProjectType => TYPE_BY_ISSUETYPE[i.fields.issuetype.name.toLowerCase()] ?? "Other";

/** Plain text from Atlassian Document Format. Good enough for a read-only summary. */
export function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text") return n.text ?? "";
  const inner = (n.content ?? []).map(adfToText).join(n.type === "paragraph" || n.type === "heading" ? "" : "\n");
  return ["paragraph", "heading", "listItem", "bulletList", "orderedList"].includes(n.type ?? "") ? `${inner}\n` : inner;
}

export function toProject(issue: JiraIssue): Project {
  const f = issue.fields;
  const done = f.status.statusCategory.key === "done";
  const group: ProjectGroup = done ? "closed" : f.issuetype.name === "I have an idea" ? "ideas" : "open";
  const people = [f.assignee, ...(f.customfield_10142 ?? [])].filter((u): u is NonNullable<typeof u> => !!u);
  const unique = people.filter((u, i) => people.findIndex((x) => x.accountId === u.accountId) === i);
  return {
    id: issue.key,
    jiraKey: issue.key,
    title: f.summary,
    group,
    stage: stageOf(issue),
    flag: flagOf(issue),
    issueType: { name: f.issuetype.name, level: f.issuetype.hierarchyLevel ?? 0 },
    parentKey: f.parent?.key,
    parentTitle: f.parent?.fields?.summary,
    statusName: f.status.name,
    statusCategory: f.status.statusCategory.key as "new" | "indeterminate" | "done",
    // undefined = this site has no usable Start date field, so nothing is flagged; "" = the field exists and is empty
    startDate: "startDate" in f ? (typeof f.startDate === "string" ? f.startDate.slice(0, 10) : "") : undefined,
    resolvedAt: typeof f.resolutiondate === "string" ? f.resolutiondate.slice(0, 10) : undefined,
    type: projectTypeOf(issue),
    // The site's Requestor field wins when it's filled in; otherwise the reporter is the requester.
    requesterId: (f.requestor ?? f.reporter)?.accountId ?? "",
    requesterName: (f.requestor ?? f.reporter)?.displayName,
    viaHub: Array.isArray(f.labels) ? f.labels.includes(HUB_LABEL) : undefined,
    krId: krFromLabels(f.labels).krId,
    krNone: krFromLabels(f.labels).none,
    assigneeId: f.assignee?.accountId,
    assigneeName: f.assignee?.displayName,
    collaboratorIds: unique.map((u) => u.accountId),
    collaboratorNames: unique.map((u) => u.displayName),
    deadline: f.duedate ?? "",
    // Not derivable from Jira alone yet; these come from the app's own comment and review data later.
    actionRequired: false,
    newComments: 0,
    assetIds: [],
    submittedAt: f.created.slice(0, 10),
    description: adfToText(f.description).trim() || undefined,
  };
}

const CAL_STATUS = (i: JiraIssue): CalStatus => {
  const name = i.fields.status.name.toLowerCase();
  if (i.fields.status.statusCategory.key === "done") return "Published";
  if (name.includes("review") || name.includes("feedback")) return "Needs Review";
  return i.fields.status.statusCategory.key === "new" ? "Idea" : "Drafting";
};

export function toCalendarItem(issue: JiraIssue, dateField: string, source: { id: string; name: string }): CalendarItem | null {
  const raw = issue.fields[dateField === "duedate" ? "duedate" : dateField];
  const date = typeof raw === "string" ? raw.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const type: ItemType = issue.fields.issuetype.name === "Campaigns or activations" ? "campaign" : "other";
  return {
    id: `${source.id}:${issue.key}`, type, title: issue.fields.summary, date, status: CAL_STATUS(issue), statusDerived: false,
    owner: issue.fields.assignee?.displayName ?? "Unassigned", campaign: "", description: adfToText(issue.fields.description).trim().slice(0, 400),
    jiraKey: issue.key, sourceId: source.id, sourceName: source.name, sourceRef: issue.key,
  };
}

/** One ticket's full read: the list shape plus the description as Jira's rich-text document. */
export const toProjectDetail = (issue: JiraIssue): Project => ({ ...toProject(issue), descriptionAdf: issue.fields.description ?? undefined });
