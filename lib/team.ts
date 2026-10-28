// Who is working on what. Pure so it can be tested; the Team page only draws it.
import type { Person, Project } from "@/lib/types";
import { addDay } from "@/lib/myday/plan";

export type Lane = { id: string; name: string; projects: Project[] };

const byDeadline = (a: Project, b: Project) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.submittedAt.localeCompare(b.submittedAt) || a.jiraKey.localeCompare(b.jiraKey);

/**
 * One lane per creative team member (even with nothing assigned), plus anyone else who holds open tickets, and the
 * queue of open tickets nobody has picked up. Closed work is left out.
 */
export function buildLanes(projects: Project[], members: Person[]): { lanes: Lane[]; unassigned: Project[] } {
  const open = projects.filter((p) => p.group !== "closed");
  const unassigned = open.filter((p) => !p.assigneeId).sort(byDeadline);
  const byId = new Map<string, Lane>(members.map((m) => [m.id, { id: m.id, name: m.name, projects: [] }]));
  for (const p of open) {
    if (!p.assigneeId) continue;
    let lane = byId.get(p.assigneeId);
    if (!lane) { lane = { id: p.assigneeId, name: p.assigneeName ?? "Teammate", projects: [] }; byId.set(p.assigneeId, lane); }
    lane.projects.push(p);
  }
  const lanes = [...byId.values()].map((l) => ({ ...l, projects: l.projects.sort(byDeadline) })).sort((a, b) => a.name.localeCompare(b.name));
  return { lanes, unassigned };
}

/** Monday of the week containing `day` (YYYY-MM-DD). */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return addDay(day, -((dow + 6) % 7));
}

/** The five working days of the week that starts on `monday`. */
export const workWeek = (monday: string): string[] => Array.from({ length: 5 }, (_, i) => addDay(monday, i));

/**
 * Which working day a deadline lands on for the calendar: weekend deadlines show on that week's Friday, so nothing due
 * is out of sight. Null when the deadline is outside the week.
 */
export function calendarDay(deadline: string, monday: string): { day: string; weekend: "Sat" | "Sun" | null } | null {
  if (!deadline) return null;
  const week = workWeek(monday);
  if (week.includes(deadline)) return { day: deadline, weekend: null };
  if (deadline === addDay(monday, 5)) return { day: week[4], weekend: "Sat" };
  if (deadline === addDay(monday, 6)) return { day: week[4], weekend: "Sun" };
  return null;
}
