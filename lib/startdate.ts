import type { Project } from "./types";

/** Open tickets whose Start date field exists but is empty. Closed work and sites without the field are never flagged. */
export const needsStartDate = (p: Pick<Project, "group" | "startDate">): boolean => p.group !== "closed" && p.startDate === "";

/** Why a start date can't be saved, or null. */
export function startDateProblem(date: string, deadline: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a date.";
  if (deadline && date > deadline) return "The start date can't be after the deadline.";
  return null;
}
