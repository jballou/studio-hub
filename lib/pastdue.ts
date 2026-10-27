import { daysBetween } from "./myday/plan";
import type { Project } from "./types";

/** Whole days an open ticket is past its deadline, or null when it isn't (or is closed or has no deadline). */
export function pastDueDays(p: Pick<Project, "group" | "deadline">, today: string): number | null {
  if (p.group === "closed" || !p.deadline) return null;
  const d = daysBetween(p.deadline, today);
  return d > 0 ? d : null;
}

export const pastDueWords = (days: number) => (days === 1 ? "1 day" : `${days} days`);
