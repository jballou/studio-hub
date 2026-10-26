import type { BriefInput, Project } from "@/lib/types";

/** Data boundary for projects/briefs; the Jira-backed adapter replaces the mock later. */
export interface ProjectsRepo {
  listProjects(viewerId: string): Promise<Project[]>;
  createBrief(input: BriefInput, requesterId: string): Promise<{ jiraKey: string }>;
}

const projects: Project[] = [
  { id: "p1", jiraKey: "MKTGCRTV-101", title: "Spring campaign: social ad", group: "open", stage: "In feedback", type: "Social", requesterId: "u-riley", collaboratorIds: ["u-avery"], deadline: "2026-10-30", actionRequired: true, newComments: 3, assetIds: ["a-ad"] },
  { id: "p2", jiraKey: "MKTGCRTV-102", title: "Product teaser (15s)", group: "open", stage: "In progress", type: "Video", requesterId: "u-riley", collaboratorIds: ["u-sam"], deadline: "2026-11-06", actionRequired: false, newComments: 0, assetIds: ["a-video"] },
  { id: "p3", jiraKey: "MKTGCRTV-103", title: "Brand one-pager", group: "open", stage: "In review", type: "Print", requesterId: "u-jordan", collaboratorIds: ["u-sam", "u-riley"], deadline: "2026-11-12", actionRequired: true, newComments: 1, assetIds: ["a-pdf"] },
  { id: "p4", jiraKey: "MKTGCRTV-110", title: "Webinar landing page refresh", group: "ideas", stage: "Submitted", type: "Web", requesterId: "u-jordan", collaboratorIds: [], deadline: "2026-12-01", actionRequired: false, newComments: 0, assetIds: [] },
  { id: "p5", jiraKey: "MKTGCRTV-090", title: "Summer promo banner set", group: "closed", stage: "Delivered", type: "Social", requesterId: "u-riley", collaboratorIds: ["u-avery"], deadline: "2026-09-15", actionRequired: false, newComments: 0, assetIds: ["a-ad"] },
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
  async createBrief(input, requesterId) {
    const jiraKey = `MKTGCRTV-${++seq}`;
    projects.push({
      id: `p${seq}`, jiraKey, title: input.title, group: "open", stage: "Submitted",
      type: input.assetTypes[0] ?? "Social", requesterId, collaboratorIds: input.stakeholderIds,
      deadline: input.deadline, actionRequired: false, newComments: 0, assetIds: [],
    });
    return { jiraKey };
  },
};
