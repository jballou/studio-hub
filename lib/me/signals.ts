// What a person's week looked like, gathered from the Hub's own sources. Shapes and pure helpers only; the
// collector that fills it in is lib/me/collect.ts. This never leaves the signed-in person's own requests.
import type { Note } from "./types";
import type { WeekWindow } from "./week";

export type TicketSignal = {
  key: string;
  title: string;
  status: string;
  done: boolean;
  krId?: string;
  krNone?: boolean;
  /** status changes inside the week, oldest first */
  moves: { to: string; at: string }[];
  /** resolved inside the week */
  closedThisWeek: boolean;
  due?: string;
  /** due date was changed inside the week (usually a slip) */
  dueChanges: number;
  /** open and the due date has passed by the end of the week */
  overdue: boolean;
  /** Jira flag-style statuses such as Blocked or At risk */
  flagged?: string;
};

export type ReviewSignal = { commentsWritten: number; assets: { name: string; projectKey: string }[] };
export type TaskSignal = { title: string; doneAt: string };
export type MeetingSignal = { title: string; start: string; end: string; attendees: number };

export type SourceStatus = { ok: boolean; /** plain reason when not ok, e.g. "Google isn't connected" */ note?: string };
export type SourceName = "jira" | "review" | "tasks" | "notes" | "calendar";

export type WeekSignals = {
  window: WeekWindow;
  tickets: TicketSignal[];
  review: ReviewSignal;
  tasksDone: TaskSignal[];
  notes: Note[];
  meetings: MeetingSignal[];
  /** Open tickets with a due date, soonest first. What is coming up, for the "owed next" part of a report. */
  openAhead?: TicketSignal[];
  sources: Record<SourceName, SourceStatus>;
};

export type KrGroup = {
  /** kr id, "none" for business as usual, or "untagged" */
  id: string;
  label: string;
  objective?: string;
  tickets: TicketSignal[];
  notes: Note[];
};

/** Tickets and notes grouped by the KR they support. Untagged work gets its own group so it can't hide. */
export function groupByKr(s: Pick<WeekSignals, "tickets" | "notes">, krs: { id: string; kr: string; objective: string }[]): KrGroup[] {
  const groups = new Map<string, KrGroup>();
  const get = (id: string): KrGroup => {
    let g = groups.get(id);
    if (!g) {
      const k = krs.find((x) => x.id === id);
      g = { id, label: id === "none" ? "Business as usual" : id === "untagged" ? "Not tagged to a KR" : k?.kr ?? "KR no longer in the OKR sheet", objective: k?.objective, tickets: [], notes: [] };
      groups.set(id, g);
    }
    return g;
  };
  for (const t of s.tickets) get(t.krNone ? "none" : t.krId ?? "untagged").tickets.push(t);
  for (const n of s.notes) get(n.krId ?? "untagged").notes.push(n);
  const rank = (g: KrGroup) => (g.id === "untagged" ? 2 : g.id === "none" ? 1 : 0);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || b.tickets.length + b.notes.length - (a.tickets.length + a.notes.length));
}

/** Headline counts for the interview's gap scan and the report header. */
export function counts(s: WeekSignals) {
  return {
    tickets: s.tickets.length,
    closed: s.tickets.filter((t) => t.closedThisWeek).length,
    slipped: s.tickets.filter((t) => t.dueChanges > 0 || t.overdue).length,
    flagged: s.tickets.filter((t) => t.flagged).length,
    untagged: s.tickets.filter((t) => !t.krId && !t.krNone).length,
    notes: s.notes.length,
    meetings: s.meetings.length,
    tasksDone: s.tasksDone.length,
  };
}
