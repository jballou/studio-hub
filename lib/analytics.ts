// How long work takes. Pure, so the numbers can be tested. All in calendar days.
//   Time open  = ticket created -> resolved (how long it sat open).
//   Real work  = Start date -> resolved (how long the work itself took). Only tickets with a start date count.
import type { Project } from "@/lib/types";

const dayNum = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86_400_000); };
export const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from);

export type Closed = Pick<Project, "jiraKey" | "title" | "type" | "issueType" | "submittedAt" | "startDate" | "resolvedAt" | "assigneeId" | "assigneeName">;

/** Days from created to resolved, or null if either date is missing or they are out of order. */
export function openDays(p: Closed): number | null {
  if (!p.submittedAt || !p.resolvedAt) return null;
  const d = daysBetween(p.submittedAt, p.resolvedAt);
  return d >= 0 ? d : null;
}

/** Days from Start date to resolved. Null with no start date, or a start date after the ticket closed (bad data). */
export function workDays(p: Closed): number | null {
  if (!p.startDate || !p.resolvedAt) return null;
  const d = daysBetween(p.startDate, p.resolvedAt);
  return d >= 0 ? d : null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export type Stats = {
  label: string;
  /** tickets closed */
  n: number;
  openAvg: number | null; openMedian: number | null;
  /** tickets that have a usable start date */
  workN: number;
  workAvg: number | null; workMedian: number | null;
  /** share of closed tickets with a usable start date, 0..1 (null when nothing closed) */
  coverage: number | null;
};

export function summarize(label: string, list: Closed[]): Stats {
  const open = list.map(openDays).filter((x): x is number => x !== null);
  const work = list.map(workDays).filter((x): x is number => x !== null);
  return {
    label, n: list.length,
    openAvg: mean(open), openMedian: median(open),
    workN: work.length, workAvg: mean(work), workMedian: median(work),
    coverage: list.length ? work.length / list.length : null,
  };
}

/** One row per group, most tickets first. */
export function groupStats(list: Closed[], key: (p: Closed) => string): Stats[] {
  const groups = new Map<string, Closed[]>();
  for (const p of list) { const k = key(p) || "Unknown"; groups.set(k, [...(groups.get(k) ?? []), p]); }
  return [...groups].map(([k, v]) => summarize(k, v)).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

export const byIssueType = (p: Closed) => p.issueType?.name ?? "Unknown";
export const byProjectType = (p: Closed) => p.type;
export const byPerson = (p: Closed) => p.assigneeName ?? (p.assigneeId ? "Teammate" : "Unassigned");

/** "3.4 days", "1 day", "under a day" for tiny averages. Null shows as a dash. */
export function daysLabel(d: number | null): string {
  if (d === null) return "n/a";
  if (d < 0.5) return "under a day";
  const r = Math.round(d * 10) / 10;
  return `${r} ${r === 1 ? "day" : "days"}`;
}
export const percentLabel = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
