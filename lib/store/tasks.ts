import { randomUUID } from "node:crypto";
import { userDocId } from "@/lib/google/crypto";
import type { PersonalTask } from "@/lib/types";
import { readDoc, updateDoc } from "./doc";
import { AdminError } from "./users";

// Personal tasks, one small document per person. `g` is the link to the Google Tasks copy; tombstones
// (deleted: true) stay until the Google copy is gone, then are dropped.
type Stored = PersonalTask & { g?: { listId: string; taskId: string }; deleted?: boolean };
type TasksDoc = { tasks: Stored[] };
const empty = (): TasksDoc => ({ tasks: [] });
const name = (email: string) => `tasks/${userDocId(email)}`;
const now = () => new Date().toISOString();

export type TaskInput = { title?: unknown; notes?: unknown; date?: unknown; time?: unknown; tz?: unknown; done?: unknown };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function clean(input: TaskInput, partial: boolean): Partial<Stored> {
  const out: Partial<Stored> = {};
  if (!partial || input.title !== undefined) {
    const title = String(input.title ?? "").trim().slice(0, 200);
    if (!title) throw new AdminError(400, "Give the task a title.");
    out.title = title;
  }
  if (input.notes !== undefined) out.notes = String(input.notes).trim().slice(0, 2000) || undefined;
  if (input.date !== undefined) {
    const d = String(input.date ?? "");
    if (d && !DATE_RE.test(d)) throw new AdminError(400, "That date doesn't look right.");
    out.date = d || undefined;
    if (!d) { out.time = undefined; out.tz = undefined; }
  }
  if (input.time !== undefined) {
    const t = String(input.time ?? "");
    if (t && !TIME_RE.test(t)) throw new AdminError(400, "That time doesn't look right.");
    out.time = t || undefined;
  }
  if (input.tz !== undefined) {
    const tz = String(input.tz ?? "");
    if (tz) { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { throw new AdminError(400, "Unknown time zone."); } }
    out.tz = tz || undefined;
  }
  if (input.done !== undefined) out.done = input.done === true;
  return out;
}

const pub = (t: Stored): PersonalTask => {
  const { g, deleted, ...rest } = t;
  void g; void deleted;
  return rest;
};

export async function listTasks(email: string): Promise<{ tasks: Stored[] }> {
  const { data } = await readDoc(name(email), empty);
  return { tasks: data.tasks };
}
export const visible = (tasks: Stored[]) => tasks.filter((t) => !t.deleted).map(pub);

export async function addTask(email: string, input: TaskInput): Promise<Stored> {
  const f = clean(input, false);
  return updateDoc(name(email), empty, (d) => {
    if (d.tasks.filter((t) => !t.deleted).length >= 500) throw new AdminError(400, "That's a lot of tasks. Clear some completed ones first.");
    const t: Stored = { id: randomUUID(), title: f.title!, notes: f.notes, date: f.date, time: f.time, tz: f.tz, done: false, createdAt: now(), updatedAt: now(), backup: "pending" };
    d.tasks.push(t);
    return { data: d, result: t };
  });
}

export async function patchTask(email: string, id: string, input: TaskInput): Promise<Stored> {
  const f = clean(input, true);
  return updateDoc(name(email), empty, (d) => {
    const t = d.tasks.find((x) => x.id === id && !x.deleted);
    if (!t) throw new AdminError(404, "That task doesn't exist anymore.");
    Object.assign(t, f, { updatedAt: now(), backup: "pending" });
    if (f.done !== undefined) t.doneAt = f.done ? now() : undefined;
    return { data: d, result: t };
  });
}

export async function removeTask(email: string, id: string): Promise<Stored | null> {
  return updateDoc(name(email), empty, (d) => {
    const t = d.tasks.find((x) => x.id === id && !x.deleted);
    if (!t) return { data: d, result: null };
    if (t.g) { t.deleted = true; t.updatedAt = now(); } // keep until the Google copy is deleted
    else d.tasks = d.tasks.filter((x) => x !== t);
    return { data: d, result: t };
  });
}

/** Records the outcome of a Google push. Done in one write so concurrent edits aren't lost. */
export async function recordSync(
  email: string,
  results: { id: string; g?: { listId: string; taskId: string }; backup: PersonalTask["backup"]; purge?: boolean; at: string }[],
): Promise<void> {
  if (!results.length) return;
  await updateDoc(name(email), empty, (d) => {
    for (const r of results) {
      const t = d.tasks.find((x) => x.id === r.id);
      if (!t) continue;
      if (r.purge) { d.tasks = d.tasks.filter((x) => x !== t); continue; }
      if (r.g) t.g = r.g;
      // Only mark synced if nothing changed since the copy we pushed.
      if (r.backup !== "synced" || t.updatedAt <= r.at) t.backup = r.backup;
    }
    return { data: d, result: undefined };
  });
}
