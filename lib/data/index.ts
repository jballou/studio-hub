import { mockRepo } from "./mock";
import type { ReviewRepo } from "./repo";

// Swap for the Drizzle/Jira adapter once auth and DB land (Days 3-6).
export const repo: ReviewRepo = mockRepo;
export { mockControls } from "./mock";
import { isJira } from "./mode";
import { jiraProjects } from "./jira";
import { mockProjects } from "./projects";
import type { ProjectsRepo } from "./projects";

/** Mock demo data by default; real Jira when NEXT_PUBLIC_DATA_SOURCE=jira. */
export const projectsRepo: ProjectsRepo = isJira ? jiraProjects : mockProjects;
export { isJira };
