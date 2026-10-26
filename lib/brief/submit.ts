import type { BriefSubmission, Person } from "@/lib/types";
import { display, optionsOf, walk, type Answers, type Flow } from "./flow";

/** Turns the wizard's answers into what a ticket needs. Only questions actually asked (the path taken) are included. */
export function toSubmission(flow: Flow, answers: Answers): BriefSubmission {
  const { path } = walk(flow, answers);
  const get = (field: string) => path.find((n) => n.field === field);
  const typeNode = get("type");
  const typeId = typeof answers.type === "string" ? answers.type : undefined;
  const typeOpt = typeNode ? optionsOf(typeNode).find((o) => o.id === typeId) : undefined;
  const titleNode = get("title");
  const deadlineNode = get("deadline");
  const peopleNode = get("stakeholders");

  const reserved = new Set(["type", "title", "deadline", "stakeholders"]);
  const sections = path
    .filter((n) => !reserved.has(n.field))
    .map((n) => ({ label: n.label || n.prompt, value: display(n, answers[n.field]).trim() }))
    .filter((s) => s.value);

  return {
    issueTypeId: typeOpt?.jiraIssueTypeId,
    typeLabel: typeOpt?.label ?? "Request",
    title: titleNode && typeof answers.title === "string" ? answers.title.trim() : "Untitled request",
    deadline: deadlineNode && typeof answers.deadline === "string" && answers.deadline ? answers.deadline : undefined,
    stakeholders: peopleNode && Array.isArray(answers.stakeholders) ? (answers.stakeholders as Person[]) : [],
    sections,
  };
}

/** Plain-text version for the ticket description and the review screen. */
export const sectionsToText = (sections: BriefSubmission["sections"]) => sections.map((s) => `${s.label}\n${s.value}`).join("\n\n");
