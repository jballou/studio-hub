import type { PersonalTask } from "@/lib/types";
import type { CalendarItem, CalendarSource, SourceResult } from "./types";

export const MY_TASKS_SOURCE: CalendarSource = { id: "my-tasks", name: "My tasks", kind: "sheet", defaultType: "task", builtin: true };

/** Personal tasks with a due date, shaped as calendar items. Only the owner ever sees them. */
export function tasksResult(tasks: PersonalTask[]): SourceResult {
  const items: CalendarItem[] = tasks.filter((t) => t.date).map((t) => {
    const [h, m] = (t.time ?? "").split(":").map(Number);
    return {
      id: `task-${t.id}`,
      type: "task",
      title: t.title,
      date: t.date!,
      time: t.time ? h * 60 + m : null,
      // Tasks have no workflow; "Published" just means done so it reads as finished in the shared status filter.
      status: t.done ? "Published" : "Scheduled",
      statusDerived: true,
      owner: "You",
      campaign: "",
      description: t.notes ?? "",
      sourceId: MY_TASKS_SOURCE.id,
      sourceName: MY_TASKS_SOURCE.name,
      sourceRef: "My Day",
    };
  });
  return { sourceId: MY_TASKS_SOURCE.id, items, warnings: [], loadedAt: new Date().toISOString() };
}
