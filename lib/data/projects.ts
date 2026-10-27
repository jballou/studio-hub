import { startDateProblem } from "@/lib/startdate";
import type { BriefSubmission, Project, Relations } from "@/lib/types";

/** Data boundary for projects/briefs; the Jira-backed adapter replaces the mock later. */
export interface ProjectsRepo {
  /** scope "mine" (default for the Projects page) is work assigned to the viewer; "all" is everything they may see. */
  listProjects(viewerId: string, scope?: "mine" | "all", group?: "open" | "closed" | "all"): Promise<Project[]>;
  getProject(jiraKey: string, viewerId: string): Promise<Project | null>;
  /** Live ticket search by key, number or title. The real adapter runs a Jira search as the viewer. */
  searchProjects(viewerId: string, query: string, limit?: number): Promise<Project[]>;
  /** Parents, children and linked tickets. Null when they can't be read; the page still works without them. */
  relations(jiraKey: string): Promise<Relations | null>;
  /** Sets the ticket's start date (YYYY-MM-DD). Rejects with a plain message. */
  setStartDate(jiraKey: string, date: string): Promise<void>;
  /** Moves a ticket to a board status. Rejects with a plain message when Jira or the rules say no. */
  moveTo(jiraKey: string, status: string): Promise<void>;
  /** Open tickets assigned to the signed-in person, soonest deadline first. */
  myWork(viewerId: string): Promise<Project[]>;
  createBrief(input: BriefSubmission, requesterId: string): Promise<{ jiraKey: string }>;
}

const projects: Project[] = [
  { id: "p95", jiraKey: "MKTGCRTV-95", issueType: { name: "Epic", level: 1 }, title: "Spring campaign", startDate: "2026-10-01", group: "open", stage: "In progress", type: "Campaign", requesterId: "u-riley", collaboratorIds: ["u-avery"], deadline: "2026-11-20", actionRequired: false, newComments: 0, assetIds: [], submittedAt: "2026-09-28" },
  { id: "p1", jiraKey: "MKTGCRTV-101", parentKey: "MKTGCRTV-95", parentTitle: "Spring campaign", issueType: { name: "Task", level: 0 }, title: "Spring campaign: social ad", startDate: "2026-10-06", group: "open", stage: "In feedback", type: "Social", requesterId: "u-riley", collaboratorIds: ["u-avery"], deadline: "2026-10-30", actionRequired: true, newComments: 3, assetIds: ["a-ad"], submittedAt: "2026-10-05", brief: { problem: "Our spring offer is not getting noticed on mobile feeds.", opportunity: "A clear, bold social ad can lift sign-ups during the spring push.", scope: "One static social ad, two sizes (1:1 and 4:5).", requirements: "Use spring brand palette. Include the 20% offer and a Get started CTA.", antiGoals: "No stock photography. No competitor mentions.", deliverables: "PNG exports for LinkedIn and Instagram.", northStar: "Click-through rate above 1.2%.", openQuestions: "Do we need a Spanish version?" } },
  { id: "p2", jiraKey: "MKTGCRTV-102", parentKey: "MKTGCRTV-95", parentTitle: "Spring campaign", issueType: { name: "Task", level: 0 }, title: "Product teaser (15s)", startDate: "2026-10-14", group: "open", stage: "In progress", flag: "blocked", type: "Video", requesterId: "u-riley", collaboratorIds: ["u-sam"], deadline: "2026-11-06", actionRequired: false, newComments: 0, assetIds: ["a-video"], submittedAt: "2026-10-12", brief: { problem: "The AI analysis launch needs a short teaser for social.", scope: "A 15 second teaser cut for LinkedIn and Instagram Reels.", deliverables: "MP4, 16:9 and 9:16.", northStar: "Teaser views above 20k in week one." } },
  { id: "p3", jiraKey: "MKTGCRTV-103", parentKey: "MKTGCRTV-95", parentTitle: "Spring campaign", issueType: { name: "Task", level: 0 }, title: "Brand one-pager", startDate: "", group: "open", stage: "In review", type: "Print", requesterId: "u-jordan", collaboratorIds: ["u-sam", "u-riley"], deadline: "2026-10-20", actionRequired: true, newComments: 1, assetIds: ["a-pdf"], submittedAt: "2026-10-14", brief: { problem: "Sales needs a refreshed brand one-pager.", scope: "Two-page PDF, print and digital.", deliverables: "PDF and editable source." } },
  { id: "p4", jiraKey: "MKTGCRTV-110", title: "Webinar landing page refresh", startDate: "", group: "ideas", stage: "Submitted", flag: "at-risk", type: "Web", requesterId: "u-jordan", collaboratorIds: [], deadline: "2026-12-01", actionRequired: false, newComments: 0, assetIds: [], submittedAt: "2026-10-20" },
  { id: "p5", jiraKey: "MKTGCRTV-090", title: "Summer promo banner set", group: "closed", stage: "Delivered", type: "Social", requesterId: "u-riley", collaboratorIds: ["u-avery"], deadline: "2026-09-15", actionRequired: false, newComments: 0, assetIds: ["a-ad"], submittedAt: "2026-08-20" },
];

const ref = (key: string, title: string, typeName: string, level: number, status: string, statusCategory: "new" | "indeterminate" | "done", inHub = true) => ({ key, title, typeName, level, status, statusCategory, inHub });
const initiative = ref("BRAND-4", "2026 brand refresh", "Initiative", 2, "In Progress", "indeterminate", false);
const springEpic = ref("MKTGCRTV-95", "Spring campaign", "Epic", 1, "In Progress", "indeterminate");
const DEMO_RELATIONS: Record<string, Relations> = {
  "MKTGCRTV-101": {
    ancestors: [initiative, springEpic],
    children: [
      { ...ref("MKTGCRTV-141", "Resize ad for LinkedIn", "Sub-task", -1, "Done", "done"), subtasks: [] },
      { ...ref("MKTGCRTV-142", "Resize ad for Instagram", "Sub-task", -1, "In Progress", "indeterminate"), subtasks: [] },
    ],
    links: [
      { ...ref("MKTGCRTV-103", "Brand one-pager", "Task", 0, "In Review", "indeterminate"), kind: "blockedBy", label: "is blocked by" },
      { ...ref("MKTGCRTV-102", "Product teaser (15s)", "Task", 0, "Blocked", "indeterminate"), kind: "blocks", label: "blocks" },
      { ...ref("MKTGCRTV-110", "Webinar landing page refresh", "Task", 0, "Intake", "new"), kind: "related", label: "relates to" },
    ],
  },
  "MKTGCRTV-95": {
    ancestors: [initiative],
    children: [
      { ...ref("MKTGCRTV-101", "Spring campaign: social ad", "Task", 0, "In Progress", "indeterminate"), subtasks: [ref("MKTGCRTV-141", "Resize ad for LinkedIn", "Sub-task", -1, "Done", "done"), ref("MKTGCRTV-142", "Resize ad for Instagram", "Sub-task", -1, "In Progress", "indeterminate")] },
      { ...ref("MKTGCRTV-102", "Product teaser (15s)", "Task", 0, "Blocked", "indeterminate"), subtasks: [] },
      { ...ref("MKTGCRTV-103", "Brand one-pager", "Task", 0, "In Review", "indeterminate"), subtasks: [] },
    ],
    links: [],
  },
  "MKTGCRTV-102": { ancestors: [initiative, springEpic], children: [], links: [{ ...ref("MKTGCRTV-101", "Spring campaign: social ad", "Task", 0, "In Progress", "indeterminate"), kind: "blockedBy", label: "is blocked by" }] },
  "MKTGCRTV-103": { ancestors: [initiative, springEpic], children: [], links: [{ ...ref("MKTGCRTV-101", "Spring campaign: social ad", "Task", 0, "In Progress", "indeterminate"), kind: "blocks", label: "blocks" }] },
};

let seq = 130;

const projectTypeFor = (label: string): Project["type"] => {
  const l = label.toLowerCase();
  if (l.includes("graphic")) return "Graphic";
  if (l.includes("video") || l.includes("animation")) return "Video";
  if (l.includes("web")) return "Web";
  if (l.includes("copy")) return "Copy";
  if (l.includes("campaign")) return "Campaign";
  return "Other";
};

export const mockProjects: ProjectsRepo = {
  async listProjects(viewerId, scope = "all", group = "all") {
    // Real adapter: reporter OR assignee OR watcher OR invited reviewer, intersected with Jira Browse.
    const creative = ["u-avery", "u-sam"].includes(viewerId);
    return structuredClone(
      projects.filter((p) => (creative || p.requesterId === viewerId || p.collaboratorIds.includes(viewerId)) && (scope === "all" || !creative || p.collaboratorIds.includes(viewerId)) && (group === "all" || (group === "closed") === (p.group === "closed"))),
    );
  },
  async searchProjects(viewerId, query, limit = 8) {
    const creative = ["u-avery", "u-sam"].includes(viewerId);
    const t = query.trim().toLowerCase();
    return structuredClone(
      projects
        .filter((p) => creative || p.requesterId === viewerId || p.collaboratorIds.includes(viewerId))
        .filter((p) => !t || p.jiraKey.toLowerCase().includes(t) || p.title.toLowerCase().includes(t))
        .slice(0, limit),
    );
  },
  async relations(jiraKey) {
    return structuredClone(DEMO_RELATIONS[jiraKey] ?? { ancestors: [], children: [], links: [] });
  },
  async setStartDate(jiraKey, date) {
    const p = projects.find((x) => x.jiraKey === jiraKey);
    if (!p) throw new Error("That ticket doesn't exist.");
    const problem = startDateProblem(date, p.deadline);
    if (problem) throw new Error(problem);
    p.startDate = date;
  },
  async moveTo(jiraKey, status) {
    const p = projects.find((x) => x.jiraKey === jiraKey);
    if (!p) throw new Error("That ticket doesn't exist.");
    if (p.flag === "blocked") throw new Error("This ticket is blocked. Open it and use “Mark as unblocked” to choose its next status.");
    // Demo: the app's own stages stand in for Jira statuses.
    const closing = ["Done", "Cancelled", "Won't Do", "Duplicate"].includes(status);
    p.stage = closing ? "Delivered" : status === "In Review" ? "In review" : status === "In Progress" ? "In progress" : "Submitted";
    p.group = closing ? "closed" : p.group === "closed" ? "open" : p.group;
  },
  async myWork(viewerId) {
    // Demo: creatives own the open projects; requesters have none assigned.
    if (!["u-avery", "u-sam"].includes(viewerId)) return [];
    return structuredClone(projects.filter((p) => p.group !== "closed").sort((a, b) => a.deadline.localeCompare(b.deadline)));
  },
  async getProject(jiraKey, viewerId) {
    const creative = ["u-avery", "u-sam"].includes(viewerId);
    const p = projects.find((x) => x.jiraKey === jiraKey);
    if (!p || !(creative || p.requesterId === viewerId || p.collaboratorIds.includes(viewerId))) return null;
    return structuredClone(p);
  },
  async createBrief(input, requesterId) {
    const jiraKey = `MKTGCRTV-${++seq}`;
    projects.push({
      id: `p${seq}`, jiraKey, title: input.title, group: "open", stage: "Submitted",
      type: projectTypeFor(input.typeLabel), requesterId, collaboratorIds: input.stakeholders.map((p) => p.id),
      collaboratorNames: input.stakeholders.map((p) => p.name),
      deadline: input.deadline ?? "", actionRequired: false, newComments: 0, assetIds: [],
      submittedAt: new Date().toISOString().slice(0, 10), briefSections: input.sections,
    });
    return { jiraKey };
  },
};
