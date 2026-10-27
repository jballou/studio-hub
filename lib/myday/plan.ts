// Builds "what to work on today" from three inputs: my open tickets, my calendar, my own tasks.
// Pure and deterministic so the same inputs always give the same plan and it can be tested without a browser.
import { zonedToInstant } from "@/lib/time";
import type { PersonalTask, Project } from "@/lib/types";

export type DayEvent = { id: string; title: string; start: string; end: string; allDay: boolean; link?: string; meetLink?: string };

export type FocusItem =
  | { kind: "ticket"; id: string; key: string; title: string; reason: string; rank: number; project: Project }
  | { kind: "task"; id: string; title: string; reason: string; rank: number; task: PersonalTask };

export type Slot = { start: number; end: number };

const DAY = 864e5;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayNum = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY; };
/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from);

const weekday = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
const short = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The moment a task is due, when it has a time. */
export function taskInstant(t: PersonalTask, localTz: string): number | null {
  if (!t.date || !t.time) return null;
  return +new Date(zonedToInstant(t.date, t.time, t.tz || localTz));
}

function dueWords(date: string | undefined, today: string): { text: string; urgency: number } | null {
  if (!date) return null;
  const d = daysBetween(today, date);
  if (d < 0) return { text: d === -1 ? "Overdue since yesterday" : `Overdue by ${-d} days`, urgency: 0 };
  if (d === 0) return { text: "Due today", urgency: 1 };
  if (d === 1) return { text: "Due tomorrow", urgency: 2 };
  if (d <= 6) return { text: `Due ${weekday(date)}`, urgency: 3 + d / 10 };
  return { text: `Due ${short(date)}`, urgency: 10 };
}

/**
 * Orders what needs attention. Overdue first, then due today, then things that are stuck or at risk,
 * then what's due soon. Tickets with no deadline that are already moving come after anything dated.
 * Far-off work is left out so the list stays about today.
 */
export function focusList(projects: Project[], tasks: PersonalTask[], today: string): FocusItem[] {
  const out: FocusItem[] = [];
  for (const p of projects) {
    if (p.group === "closed") continue;
    const due = dueWords(p.deadline || undefined, today);
    const blocked = p.flag === "blocked";
    const risky = p.flag === "at-risk" || p.flag === "needs-info";
    const reasons: string[] = [];
    if (due && due.urgency < 10) reasons.push(due.text);
    if (blocked) reasons.push("Blocked: chase the unblock");
    else if (risky) reasons.push(p.flag === "at-risk" ? "Marked at risk" : "Needs more info");
    if (p.actionRequired) reasons.push("Feedback waiting");
    if (!reasons.length) {
      // In progress and moving, but nothing forcing it today.
      if (p.stage !== "In progress" && p.stage !== "In feedback") continue;
      reasons.push(p.deadline ? due!.text : "In progress, no deadline set");
    }
    const urgency = due ? due.urgency : 9;
    out.push({ kind: "ticket", id: p.jiraKey, key: p.jiraKey, title: p.title, reason: reasons.join(" · "), project: p, rank: urgency + (blocked ? -0.4 : 0) + (risky ? -0.2 : 0) + (p.actionRequired ? -0.1 : 0) });
  }
  for (const t of tasks) {
    if (t.done) continue;
    const due = dueWords(t.date, today);
    if (due && due.urgency >= 10) continue;
    if (!due) continue; // undated tasks live in the task list, not in today's plan
    out.push({ kind: "task", id: t.id, title: t.title, reason: due.text + (t.time && due.urgency <= 1 ? ` at ${t.time}` : ""), task: t, rank: due.urgency - 0.05 });
  }
  return out.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
}

/** Gaps of at least `minMinutes` between meetings inside working hours (local time), starting no earlier than `now`. */
export function openSlots(events: DayEvent[], tasks: PersonalTask[], day: string, now: number, localTz: string, opts = { startHour: 9, endHour: 18, minMinutes: 45 }): Slot[] {
  const dayStart = +new Date(`${day}T00:00:00`);
  const wStart = Math.max(dayStart + opts.startHour * 36e5, now);
  const wEnd = dayStart + opts.endHour * 36e5;
  const busy: Slot[] = events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: +new Date(e.start), end: +new Date(e.end) }));
  // A task with a time is a commitment too; hold 30 minutes for it.
  for (const t of tasks) {
    if (t.done || t.date !== day || !t.time) continue;
    const at = taskInstant(t, localTz);
    if (at !== null && at >= dayStart && at < dayStart + DAY) busy.push({ start: at, end: at + 30 * 6e4 });
  }
  busy.sort((a, b) => a.start - b.start);
  const slots: Slot[] = [];
  let cursor = wStart;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start - cursor >= opts.minMinutes * 6e4 && b.start <= wEnd) slots.push({ start: cursor, end: Math.min(b.start, wEnd) });
    cursor = Math.max(cursor, b.end);
  }
  if (wEnd - cursor >= opts.minMinutes * 6e4) slots.push({ start: cursor, end: wEnd });
  return slots;
}

export type Suggestion = { slot: Slot; item: FocusItem };

/** Puts the most urgent items into the longest open stretches, one per stretch, earliest first. */
export function suggest(focus: FocusItem[], slots: Slot[]): Suggestion[] {
  const tickets = focus.filter((f) => f.kind === "ticket").slice(0, slots.length);
  const longest = [...slots].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, tickets.length).sort((a, b) => a.start - b.start);
  return tickets.map((item, i) => ({ item, slot: longest[i] }));
}

export const minutes = (ms: number) => Math.round(ms / 6e4);
export const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
export const localDay = (d = new Date()) => iso(d);

/** One plain sentence for the top of the page. */
export function headline(events: DayEvent[], focus: FocusItem[], today: string, slots: Slot[]): string {
  const timed = events.filter((e) => !e.allDay);
  const meetMs = timed.reduce((n, e) => n + (+new Date(e.end) - +new Date(e.start)), 0);
  const overdue = focus.filter((f) => f.reason.startsWith("Overdue")).length;
  const dueToday = focus.filter((f) => f.reason.startsWith("Due today")).length;
  const parts: string[] = [];
  parts.push(timed.length ? `${timed.length} meeting${timed.length === 1 ? "" : "s"} (${hm(minutes(meetMs))})` : "No meetings");
  if (overdue) parts.push(`${overdue} overdue`);
  if (dueToday) parts.push(`${dueToday} due today`);
  const big = [...slots].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  const tail = big ? ` Your longest open stretch is ${hm(minutes(big.end - big.start))}.` : timed.length ? " There's no open stretch left today." : "";
  return `${parts.join(", ")}.${tail}`;
}

// ---- Dashboard numbers ----

export type StatusKey = "review" | "risk" | "progress" | "tasks" | "notstarted";

/** Order and colors are fixed so a slice keeps its color however many slices are showing. Hexes are the brand's chart steps. */
export const STATUS_META: { key: StatusKey; label: string; color: string }[] = [
  { key: "review", label: "In review or feedback", color: "#5568bf" },
  { key: "risk", label: "Blocked or at risk", color: "#a95c18" },
  { key: "progress", label: "In progress", color: "#348289" },
  { key: "tasks", label: "My open tasks", color: "#a18102" },
  { key: "notstarted", label: "Not started", color: "#686764" },
];

function statusOf(p: Project): StatusKey {
  if (p.flag === "blocked" || p.flag === "at-risk" || p.flag === "needs-info" || p.flag === "on-hold") return "risk";
  if (p.stage === "In review" || p.stage === "In feedback") return "review";
  if (p.stage === "In progress") return "progress";
  return "notstarted";
}

/** How many open tickets and tasks sit in each status. Zero-count statuses are kept so the legend stays stable. */
export function statusBreakdown(projects: Project[], tasks: PersonalTask[]): { key: StatusKey; label: string; color: string; count: number }[] {
  const counts = new Map<StatusKey, number>();
  for (const p of projects) if (p.group !== "closed") counts.set(statusOf(p), (counts.get(statusOf(p)) ?? 0) + 1);
  counts.set("tasks", tasks.filter((t) => !t.done).length);
  return STATUS_META.map((m) => ({ ...m, count: counts.get(m.key) ?? 0 }));
}

export type OnTime = { score: number | null; onTime: number; late: number };

/**
 * Share of dated work that is not late. An open item is late once its deadline has passed; a finished task is
 * late if it was ticked off after its date. Tickets only count while open (closed history isn't loaded here).
 */
export function onTimeScore(projects: Project[], tasks: PersonalTask[], today: string): OnTime {
  let onTime = 0, late = 0;
  for (const p of projects) {
    if (p.group === "closed" || !p.deadline) continue;
    if (p.deadline < today) late++; else onTime++;
  }
  for (const t of tasks) {
    if (!t.date) continue;
    if (t.done) { if (t.doneAt && localDay(new Date(t.doneAt)) > t.date) late++; else onTime++; }
    else if (t.date < today) late++;
    else onTime++;
  }
  const total = onTime + late;
  return { score: total ? Math.round((onTime / total) * 100) : null, onTime, late };
}

export type Timeline = { pct: number; daysLeft: number | null; state: "ok" | "watch" | "late" | "none"; from: string; to: string };

/** Where a ticket is between the day it was submitted and its deadline. */
export function timeline(p: Project, today: string): Timeline {
  if (!p.deadline) return { pct: 0, daysLeft: null, state: "none", from: p.submittedAt, to: "" };
  const total = daysBetween(p.submittedAt, p.deadline);
  const used = daysBetween(p.submittedAt, today);
  const daysLeft = daysBetween(today, p.deadline);
  const pct = daysLeft < 0 ? 100 : total <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((used / total) * 100)));
  const state = daysLeft < 0 ? "late" : pct >= 80 && p.stage !== "In feedback" && p.stage !== "In review" ? "watch" : "ok";
  return { pct, daysLeft, state, from: p.submittedAt, to: p.deadline };
}

export const STAGES_ORDER = ["Submitted", "In review", "In progress", "In feedback", "Delivered"] as const;
