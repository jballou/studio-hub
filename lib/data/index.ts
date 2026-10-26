import { mockRepo } from "./mock";
import type { ReviewRepo } from "./repo";

// Swap for the Drizzle/Jira adapter once auth and DB land (Days 3-6).
export const repo: ReviewRepo = mockRepo;
export { mockControls } from "./mock";
import { mockProjects } from "./projects";
import type { ProjectsRepo } from "./projects";

export const projectsRepo: ProjectsRepo = mockProjects;
