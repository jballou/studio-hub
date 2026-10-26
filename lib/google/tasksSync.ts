import type { PersonalTask } from "@/lib/types";
import { listTasks, recordSync, visible } from "@/lib/store/tasks";
import { getConnection } from "@/lib/store/google";
import { createGTask, deleteGTask, ensureTaskList, GoogleError, updateGTask, type GTaskInput } from "./client";

const fmtTime = (t: PersonalTask) => {
  if (!t.time) return "";
  const [h, m] = t.time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}${t.tz ? ` (${t.tz})` : ""}`;
};

/** What Google gets: its Tasks keep only a date, so the time rides along in the notes. */
function toG(t: PersonalTask): GTaskInput {
  const lines = [t.time ? `Due ${fmtTime(t)}` : "", t.notes ?? "", "Added from Brand Creative Hub"].filter(Boolean);
  return { title: t.title, notes: lines.join("\n\n"), dueDate: t.date, done: t.done };
}

/**
 * Pushes everything that isn't backed up yet (one-way: this app is the source of truth). Never throws:
 * a failure leaves the task "pending" and the next load retries. Returns whether Google is connected.
 */
export async function syncTasks(email: string, limit = 15): Promise<{ connected: boolean; error?: string }> {
  const conn = await getConnection(email).catch(() => null);
  if (!conn || conn.broken) return { connected: false };
  const { tasks } = await listTasks(email);
  const todo = tasks.filter((t) => t.deleted || t.backup !== "synced").slice(0, limit);
  if (!todo.length) return { connected: true };
  const results: Parameters<typeof recordSync>[1] = [];
  let error: string | undefined;
  try {
    const listId = await ensureTaskList(email);
    for (const t of todo) {
      const at = t.updatedAt;
      try {
        if (t.deleted) {
          if (t.g) await deleteGTask(email, t.g.listId, t.g.taskId);
          results.push({ id: t.id, backup: "synced", purge: true, at });
        } else if (t.g) {
          await updateGTask(email, t.g.listId, t.g.taskId, toG(t));
          results.push({ id: t.id, backup: "synced", at });
        } else {
          const taskId = await createGTask(email, listId, toG(t));
          results.push({ id: t.id, g: { listId, taskId }, backup: "synced", at });
        }
      } catch (e) {
        if (e instanceof GoogleError && e.status === 404 && t.g && !t.deleted) {
          // Deleted on Google's side: recreate rather than lose the backup.
          try {
            const taskId = await createGTask(email, listId, toG(t));
            results.push({ id: t.id, g: { listId, taskId }, backup: "synced", at });
            continue;
          } catch { /* falls through to pending */ }
        }
        if (e instanceof GoogleError && e.code === "reconnect") throw e;
        results.push({ id: t.id, backup: "pending", at });
      }
    }
  } catch (e) {
    error = e instanceof GoogleError ? e.message : "Couldn't reach Google Tasks.";
    for (const t of todo) if (!results.some((r) => r.id === t.id)) results.push({ id: t.id, backup: "pending", at: t.updatedAt });
  }
  await recordSync(email, results).catch(() => {});
  return { connected: true, error };
}

/** Current tasks as the client sees them, after trying to catch Google up. */
export async function tasksForClient(email: string, sync: boolean): Promise<{ tasks: PersonalTask[]; googleConnected: boolean; syncError?: string }> {
  let status: { connected: boolean; error?: string } = { connected: !!(await getConnection(email).catch(() => null)) };
  if (sync) status = await syncTasks(email);
  const { tasks } = await listTasks(email);
  const out = visible(tasks).map((t) => (status.connected ? t : { ...t, backup: "off" as const }));
  return { tasks: out, googleConnected: status.connected, syncError: status.error };
}
