import { pastDueDays } from "./pastdue";
import type { Project, Stage } from "./types";

/** The four steps a requester sees. A ticket in Jira's review stage sits on "In progress". */
export const BRIEF_STEPS: Stage[] = ["Submitted", "In progress", "In feedback", "Delivered"];

export function stepIndex(p: Pick<Project, "stage" | "group">): number {
  if (p.group === "closed") return BRIEF_STEPS.length - 1;
  const s: Stage = p.stage === "In review" ? "In progress" : p.stage;
  return Math.max(0, BRIEF_STEPS.indexOf(s));
}

/** Something is waiting on the requester: feedback to give, or Jira asks for more information. */
export const needsInput = (p: Pick<Project, "flag" | "stage" | "actionRequired" | "group">): boolean =>
  p.group !== "closed" && (p.flag === "needs-info" || p.stage === "In feedback" || p.actionRequired);

export type BriefFilter = "all" | "active" | "input" | "delivered";

export function matchesFilter(p: Project, f: BriefFilter): boolean {
  if (f === "all") return true;
  if (f === "delivered") return p.group === "closed";
  if (f === "input") return needsInput(p);
  return p.group !== "closed";
}

export function summarize(list: Project[]): { total: number; active: number; input: number; delivered: number } {
  return { total: list.length, active: list.filter((p) => p.group !== "closed").length, input: list.filter(needsInput).length, delivered: list.filter((p) => p.group === "closed").length };
}

/** Needs-you first, then past due, then open before delivered, then newest. */
export function sortBriefs(list: Project[], today: string): Project[] {
  const rank = (p: Project) => (needsInput(p) ? 0 : pastDueDays(p, today) !== null ? 1 : p.group !== "closed" ? 2 : 3);
  return [...list].sort((a, b) => rank(a) - rank(b) || b.submittedAt.localeCompare(a.submittedAt) || b.jiraKey.localeCompare(a.jiraKey));
}

/** A short line for the card: the first answer of a Hub brief, or the start of the Jira description. */
export function excerpt(p: Pick<Project, "briefSections" | "description" | "brief">, max = 150): string {
  const raw = p.briefSections?.[0]?.value ?? p.brief?.problem ?? (p.description ?? "").replace(/^Submitted by .+? from the Brand Creative Hub\.\s*/i, "");
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
