import type { PersonalTask } from "@/lib/types";
import { isJira } from "./mode";

export type TaskDraft = { title: string; notes?: string; date?: string; time?: string; tz?: string };
export type TasksState = { tasks: PersonalTask[]; googleConnected: boolean; syncError?: string };

export interface TasksRepo {
  list(): Promise<TasksState>;
  add(t: TaskDraft): Promise<TasksState>;
  update(id: string, patch: Partial<TaskDraft> & { done?: boolean }): Promise<TasksState>;
  remove(id: string): Promise<TasksState>;
}

const changed = () => typeof window !== "undefined" && window.dispatchEvent(new Event("tasks-changed"));

async function call(url: string, init?: RequestInit): Promise<TasksState> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  changed();
  return body as TasksState;
}

const jiraTasks: TasksRepo = {
  list: () => call("/api/tasks"),
  add: (t) => call("/api/tasks", { method: "POST", body: JSON.stringify(t) }),
  update: (id, patch) => call(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id) => call(`/api/tasks/${id}`, { method: "DELETE" }),
};

// Demo mode keeps tasks in this browser only; nothing is sent to Google.
const LS = "my-tasks-demo-v1";
const read = (): PersonalTask[] => { try { return JSON.parse(localStorage.getItem(LS) ?? "[]"); } catch { return []; } };
const write = (t: PersonalTask[]) => { try { localStorage.setItem(LS, JSON.stringify(t)); } catch { /* storage unavailable */ } };
const state = (tasks: PersonalTask[]): TasksState => ({ tasks, googleConnected: false });

const demoTasks: TasksRepo = {
  async list() { return state(read()); },
  async add(t) {
    const title = t.title.trim();
    if (!title) throw new Error("Give the task a title.");
    const now = new Date().toISOString();
    const all = read();
    all.push({ id: crypto.randomUUID(), title, notes: t.notes?.trim() || undefined, date: t.date || undefined, time: t.date ? t.time || undefined : undefined, tz: t.date && t.time ? t.tz : undefined, done: false, createdAt: now, updatedAt: now, backup: "off" });
    write(all); changed();
    return state(all);
  },
  async update(id, patch) {
    const all = read();
    const t = all.find((x) => x.id === id);
    if (!t) throw new Error("That task doesn't exist anymore.");
    if (patch.title !== undefined) { if (!patch.title.trim()) throw new Error("Give the task a title."); t.title = patch.title.trim(); }
    if (patch.notes !== undefined) t.notes = patch.notes.trim() || undefined;
    if (patch.date !== undefined) { t.date = patch.date || undefined; if (!patch.date) { t.time = undefined; t.tz = undefined; } }
    if (patch.time !== undefined) t.time = patch.time || undefined;
    if (patch.tz !== undefined) t.tz = patch.tz || undefined;
    if (patch.done !== undefined) { t.done = patch.done; t.doneAt = patch.done ? new Date().toISOString() : undefined; }
    t.updatedAt = new Date().toISOString();
    write(all); changed();
    return state(all);
  },
  async remove(id) {
    const all = read().filter((t) => t.id !== id);
    write(all); changed();
    return state(all);
  },
};

export const tasksRepo: TasksRepo = isJira ? jiraTasks : demoTasks;
