// Kanban columns shared by tickets (from Jira) and tasks (made in this app). Pure so it can be tested.
import { daysBetween } from "@/lib/myday/plan";
import type { PersonalTask, Project } from "@/lib/types";

export type ColumnId = "todo" | "progress" | "review" | "done";

export const COLUMNS: { id: ColumnId; label: string; icon: "submitted" | "progress" | "review" | "delivered"; /** Jira status a ticket is moved to when dropped here */ jiraStatus: string }[] = [
  { id: "todo", label: "To do", icon: "submitted", jiraStatus: "Open" },
  { id: "progress", label: "In progress", icon: "progress", jiraStatus: "In Progress" },
  { id: "review", label: "In review", icon: "review", jiraStatus: "In Review" },
  { id: "done", label: "Done", icon: "delivered", jiraStatus: "Done" },
];

/** Real tickets sort by their Jira status (name first, then category). Demo tickets have no Jira status, so the app's stage is used. */
export function columnOfProject(p: Pick<Project, "stage" | "statusName" | "statusCategory" | "group">): ColumnId {
  if (p.statusName) {
    const n = p.statusName.toLowerCase();
    if (n === "in review" || n === "under review") return "review";
    if (p.statusCategory === "done") return "done";
    if (p.statusCategory === "new") return "todo";
    return "progress";
  }
  if (p.group === "closed" || p.stage === "Delivered") return "done";
  if (p.stage === "In review") return "review";
  if (p.stage === "In progress" || p.stage === "In feedback") return "progress";
  return "todo";
}

export const columnOfTask = (t: Pick<PersonalTask, "done" | "lane">): ColumnId => (t.done ? "done" : t.lane ?? "todo");

/** What dropping a card on a column does to a task. Tasks have no workflow, so this is just where it sits. */
export const taskPatchFor = (col: ColumnId): { done: boolean; lane?: "todo" | "progress" | "review" } =>
  col === "done" ? { done: true } : { done: false, lane: col };

export type BoardCard =
  | { kind: "ticket"; id: string; column: ColumnId; project: Project }
  | { kind: "task"; id: string; column: ColumnId; task: PersonalTask };

export function buildCards(projects: Project[], tasks: PersonalTask[], override: Record<string, ColumnId> = {}): BoardCard[] {
  const t: BoardCard[] = projects.map((project) => ({ kind: "ticket", id: project.jiraKey, column: override[`ticket:${project.jiraKey}`] ?? columnOfProject(project), project }));
  const k: BoardCard[] = tasks.map((task) => ({ kind: "task", id: task.id, column: override[`task:${task.id}`] ?? columnOfTask(task), task }));
  return [...t, ...k];
}

/** Why a ticket can't simply be dragged, or null when it can. */
export function dragBlocker(p: Pick<Project, "flag" | "group">, canMove: boolean): string | null {
  if (!canMove) return "Only the creative team can change a ticket's status.";
  if (p.flag === "blocked") return "This ticket is blocked. Open it and use “Mark as unblocked” to choose its next status.";
  return null;
}

/** Short due text for a card footer. */
export function dueLabel(date: string | undefined, today: string): { text: string; tone: "bad" | "warn" | "muted" } | null {
  if (!date) return null;
  const d = daysBetween(today, date);
  if (d < 0) return { text: d === -1 ? "Yesterday" : `${-d} days late`, tone: "bad" };
  if (d === 0) return { text: "Today", tone: "warn" };
  if (d === 1) return { text: "Tomorrow", tone: "muted" };
  if (d <= 7) return { text: `${d} days left`, tone: "muted" };
  return { text: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }), tone: "muted" };
}
