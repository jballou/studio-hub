// A weekly report drafted straight from the data, with no model. It is the fallback when the model is unavailable, and
// it also writes the KPI section in every case, so numbers in a report always come from the OKR mirror and Jira, never from a model.
import { groupByKr, type TicketSignal, type WeekSignals } from "./signals.ts";
import type { ReportBody } from "./types.ts";

export type KrFacts = { id: string; kr: string; objective: string; baseline?: string; current?: string; target?: string };

const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const tk = (t: TicketSignal) => `${t.key} ${short(t.title)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One line per KR the week's work touched. Counts come from Jira; KR values come from the OKR mirror. */
export function kpiText(s: Pick<WeekSignals, "tickets" | "notes">, krs: KrFacts[], sample = false): string {
  const lines = groupByKr(s, krs).map((g) => {
    const work = plural(g.tickets.length, "project");
    if (g.id === "none") return `Business as usual: ${work}`;
    if (g.id === "untagged") return `Not tagged to a KR: ${work}. Tag them on the Projects page so reports can place them.`;
    const k = krs.find((x) => x.id === g.id);
    if (!k) return `${g.label}: ${work}`;
    const now = k.current ? `now ${k.current}` : "no current value in the sheet";
    const range = k.baseline || k.target ? ` (baseline ${k.baseline ?? "?"}, target ${k.target ?? "?"})` : "";
    return `${k.kr}: ${now}${range}. Supported by ${work} this week.`;
  });
  if (!lines.length) return "";
  return `${sample ? "Sample goals, not real OKR figures.\n" : ""}${lines.join("\n")}`;
}

const notesOf = (s: WeekSignals, type: string) => s.notes.filter((n) => n.type === type).map((n) => n.text);

/** Facts-only draft. Plain, a little dry, and never wrong about what happened. */
export function draftFromSignals(s: WeekSignals, krs: KrFacts[], opts: { sample?: boolean; openDueNextWeek?: TicketSignal[] } = {}): ReportBody {
  const closed = s.tickets.filter((t) => t.closedThisWeek);
  const slipped = s.tickets.filter((t) => t.dueChanges > 0 || t.overdue);
  const flagged = s.tickets.filter((t) => t.flagged);
  const groups = groupByKr(s, krs).filter((g) => g.id !== "untagged" && g.id !== "none");

  const wins = [...closed.map((t) => `Shipped ${tk(t)}`), ...notesOf(s, "win")];
  const losses = [
    ...slipped.map((t) => `${tk(t)} ran late${t.dueChanges ? ` (due date moved ${t.dueChanges}×)` : ""}`),
    ...notesOf(s, "loss"),
  ];
  const blockers = [...flagged.map((t) => `${tk(t)} is ${t.flagged}`), ...notesOf(s, "blocker")];

  return {
    kpis: kpiText(s, krs, opts.sample),
    whyItMoved: [
      s.tickets.length ? `${plural(s.tickets.length, "ticket")} moved this week, ${closed.length} closed.` : "",
      s.review.commentsWritten ? `${plural(s.review.commentsWritten, "review comment")} written.` : "",
      ...notesOf(s, "growth"),
    ].filter(Boolean).join(" "),
    owedThisWeek: (opts.openDueNextWeek ?? []).map((t) => `${tk(t)}${t.due ? ` (due ${t.due})` : ""}`).join("\n"),
    blockers: blockers.join("\n"),
    discussionTopics: notesOf(s, "one_on_one").join("\n"),
    nextSteps: "",
    themes: [...new Set(groups.map((g) => g.objective ?? g.label))].slice(0, 3),
    wins,
    losses,
    opportunities: notesOf(s, "opportunity"),
  };
}
