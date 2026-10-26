import type { BriefInput, Project } from "@/lib/types";

/** Data boundary for projects/briefs; the Jira-backed adapter replaces the mock later. */
export interface ProjectsRepo {
  listProjects(viewerId: string): Promise<Project[]>;
  getProject(jiraKey: string, viewerId: string): Promise<Project | null>;
  createBrief(input: BriefInput, requesterId: string): Promise<{ jiraKey: string }>;
}

const projects: Project[] = [
  { id: "p1", jiraKey: "MKTGCRTV-101", title: "Spring campaign: social ad", group: "open", stage: "In feedback", type: "Social", requesterId: "u-riley", collaboratorIds: ["u-avery"], deadline: "2026-10-30", actionRequired: true, newComments: 3, assetIds: ["a-ad"], submittedAt: "2026-10-05", brief: { problem: "Our spring offer is not getting noticed on mobile feeds.", opportunity: "A clear, bold social ad can lift sign-ups during the spring push.", scope: "One static social ad, two sizes (1:1 and 4:5).", requirements: "Use spring brand palette. Include the 20% offer and a Get started CTA.", antiGoals: "No stock photography. No competitor mentions.", deliverables: "PNG exports for LinkedIn and Instagram.", northStar: "Click-through rate above 1.2%.", openQuestions: "Do we need a Spanish version?" } },
  { id: "p2", jiraKey: "MKTGCRTV-102", title: "Product teaser (15s)", group: "open", stage: "In progress", type: "Video", requesterId: "u-riley", collaboratorIds: ["u-sam"], deadline: "2026-11-06", actionRequired: false, newComments: 0, assetIds: ["a-video"], submittedAt: "2026-10-12", brief: { problem: "The AI analysis launch needs a short teaser for social.", scope: "A 15 second teaser cut for LinkedIn and Instagram Reels.", deliverables: "MP4, 16:9 and 9:16.", northStar: "Teaser views above 20k in week one." } },
  { id: "p3", jiraKey: "MKTGCRTV-103", title: "Brand one-pager", group: "open", stage: "In review", type: "Print", requesterId: "u-jordan", collaboratorIds: ["u-sam", "u-riley"], deadline: "2026-11-12", actionRequired: true, newComments: 1, assetIds: ["a-pdf"], submittedAt: "2026-10-14", brief: { problem: "Sales needs a refreshed brand one-pager.", scope: "Two-page PDF, print and digital.", deliverables: "PDF and editable source." } },
  { id: "p4", jiraKey: "MKTGCRTV-110", title: "Webinar landing page refresh", group: "ideas", stage: "Submitted", type: "Web", requesterId: "u-jordan", collaboratorIds: [], deadline: "2026-12-01", actionRequired: false, newComments: 0, assetIds: [], submittedAt: "2026-10-20" },
  { id: "p5", jiraKey: "MKTGCRTV-090", title: "Summer promo banner set", group: "closed", stage: "Delivered", type: "Social", requesterId: "u-riley", collaboratorIds: ["u-avery"], deadline: "2026-09-15", actionRequired: false, newComments: 0, assetIds: ["a-ad"], submittedAt: "2026-08-20" },
];

let seq = 130;

export const mockProjects: ProjectsRepo = {
  async listProjects(viewerId) {
    // Real adapter: reporter OR assignee OR watcher OR invited reviewer, intersected with Jira Browse.
    const creative = ["u-avery", "u-sam"].includes(viewerId);
    return structuredClone(
      projects.filter((p) => creative || p.requesterId === viewerId || p.collaboratorIds.includes(viewerId)),
    );
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
      type: input.assetTypes[0] ?? "Social", requesterId, collaboratorIds: input.stakeholderIds,
      deadline: input.deadline, actionRequired: false, newComments: 0, assetIds: [],
      submittedAt: new Date().toISOString().slice(0, 10), brief: input,
    });
    return { jiraKey };
  },
};
