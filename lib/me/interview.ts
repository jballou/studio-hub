// The weekly interview, minus the model. Finds what the week's data can't explain and turns each gap into a question.
// Pure (no network, no store) so it can be tested alone; lib/me/interviewAgent.ts lets a model pick and phrase the next one.
import type { MeetingSignal, TicketSignal, WeekSignals } from "./signals.ts";
import type { NoteType } from "./types.ts";

export type GapKind = "slipped" | "flagged" | "closed" | "meeting" | "quiet" | "coverage";

export type Gap = {
  /** Stable for the same data, so the page can say "I already asked this" between turns. */
  id: string;
  kind: GapKind;
  /** The plain question, used as-is when no model is available. */
  question: string;
  /** What in the data made us ask. Shown to the person ("why am I asking"), and given to the model. */
  evidence: string;
  chips: string[];
  noteType: NoteType;
  jiraKey?: string;
  krId?: string;
  /** Lower asks first. */
  priority: number;
};

export const MAX_QUESTIONS = 8;
const MAX_PER_KIND = 2;

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const label = (t: TicketSignal) => `${t.key} (${short(t.title)})`;

/** A meeting worth asking about: several people, at least half an hour, and nothing in the title ties it to a ticket we already know about. */
function interestingMeeting(m: MeetingSignal, tickets: TicketSignal[]): boolean {
  const minutes = (Date.parse(m.end) - Date.parse(m.start)) / 60_000;
  if (m.attendees < 3 || !(minutes >= 30)) return false;
  const title = m.title.toLowerCase();
  return !tickets.some((t) => title.includes(t.key.toLowerCase()));
}

const hasNote = (s: WeekSignals, type: NoteType) => s.notes.some((n) => n.type === type);

export function findGaps(s: WeekSignals): Gap[] {
  const gaps: Gap[] = [];
  const add = (g: Omit<Gap, "priority"> & { priority?: number }) => gaps.push({ priority: 3, ...g });

  s.tickets.filter((t) => t.dueChanges > 0 || t.overdue).slice(0, MAX_PER_KIND).forEach((t) =>
    add({
      id: `slipped:${t.key}`, kind: "slipped", priority: 1, jiraKey: t.key, krId: t.krId, noteType: "loss",
      question: `${label(t)} ran late. What got in the way?`,
      evidence: t.dueChanges > 0 ? `Its due date changed ${t.dueChanges}× this week.` : `It was still open past its due date (${t.due}).`,
      chips: ["Waiting on feedback", "Scope grew", "Reprioritized", "Not enough time", "Something else"],
    }),
  );

  s.tickets.filter((t) => t.flagged).slice(0, MAX_PER_KIND).forEach((t) =>
    add({
      id: `flagged:${t.key}`, kind: "flagged", priority: 1, jiraKey: t.key, krId: t.krId, noteType: "blocker",
      question: `${label(t)} is marked ${t.flagged}. What would unblock it?`,
      evidence: `Its Jira status is ${t.status}.`,
      chips: ["Waiting on a person", "Waiting on assets", "A decision is needed", "It's not blocked anymore"],
    }),
  );

  const closed = s.tickets.filter((t) => t.closedThisWeek);
  closed.slice(0, MAX_PER_KIND).forEach((t) =>
    add({
      id: `closed:${t.key}`, kind: "closed", priority: 2, jiraKey: t.key, krId: t.krId, noteType: "win",
      question: `${label(t)} shipped. How did it land?`,
      evidence: `You closed it this week.`,
      chips: ["Great feedback", "Smooth, no drama", "Rough but done", "No feedback yet"],
    }),
  );

  s.meetings.filter((m) => interestingMeeting(m, s.tickets)).slice(0, MAX_PER_KIND).forEach((m) =>
    add({
      id: `meeting:${m.start}:${short(m.title, 24)}`, kind: "meeting", priority: 2, noteType: "other",
      question: `You had “${short(m.title, 50)}” with ${m.attendees} people. Did a decision or action come out of it?`,
      evidence: `A ${m.attendees}-person meeting on your calendar with no matching ticket.`,
      chips: ["A decision was made", "New work for me", "Just informational", "Nothing came of it"],
    }),
  );

  if (s.tickets.length === 0 && s.notes.length === 0) {
    add({
      id: "quiet", kind: "quiet", priority: 1, noteType: "other",
      question: "Not much shows up in Jira this week. What did you spend your time on?",
      evidence: "No tickets assigned to you changed, and you haven't added notes.",
      chips: [],
    });
  }

  // Standard prompts, only where the week doesn't already answer them.
  if (!closed.length && !hasNote(s, "win")) add({ id: "win", kind: "coverage", priority: 4, noteType: "win", question: "What's one thing from this week you're proud of?", evidence: "No win is logged for this week.", chips: [] });
  if (!hasNote(s, "growth")) add({ id: "feedback", kind: "coverage", priority: 4, noteType: "growth", question: "Any feedback this week, good or hard, worth remembering?", evidence: "No feedback or growth note is logged for this week.", chips: [] });
  if (!hasNote(s, "opportunity")) add({ id: "opportunity", kind: "coverage", priority: 5, noteType: "opportunity", question: "Did you spot anything we should be doing that isn't on anyone's plate?", evidence: "No opportunity is logged for this week.", chips: [] });
  add({ id: "workload", kind: "coverage", priority: 6, noteType: "other", question: "How did the workload feel this week?", evidence: "A standing check-in. Only you see this.", chips: ["Light", "About right", "Heavy", "Unsustainable"] });

  return gaps.sort((a, b) => a.priority - b.priority).slice(0, MAX_QUESTIONS);
}

/** Gaps not yet asked, in priority order. */
export const remainingGaps = (gaps: Gap[], asked: readonly string[]) => gaps.filter((g) => !asked.includes(g.id));

export type Turn = { gapId: string; answer: string };

export type NextQuestion = {
  gapId: string;
  question: string;
  chips: string[];
  /** "Why am I asking": what in the data prompted it. */
  why: string;
};

/** Plain fallback: the next unasked gap, worded as written. */
export function plainNext(gaps: Gap[], asked: readonly string[]): NextQuestion | null {
  const g = remainingGaps(gaps, asked)[0];
  return g ? { gapId: g.id, question: g.question, chips: g.chips, why: g.evidence } : null;
}
