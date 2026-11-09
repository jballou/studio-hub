// Turns a week of facts into the report's narrative. The model writes prose only; KPI numbers are computed in reportDraft.ts.
// It is told to use only what it is given, and any failure returns the facts-only draft instead.
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { draftFromSignals, kpiText, type KrFacts } from "./reportDraft.ts";
import { groupByKr, type TicketSignal, type WeekSignals } from "./signals.ts";
import type { ReportBody } from "./types.ts";

export const REPORT_MODEL = process.env.REPORT_MODEL ?? "anthropic/claude-sonnet-5.5";
const TIMEOUT_MS = 40_000;

const list = z.array(z.string().max(300)).max(8);
const Schema = z.object({
  whyItMoved: z.string().max(1200),
  owedThisWeek: z.string().max(1200),
  blockers: z.string().max(1200),
  discussionTopics: z.string().max(1200),
  nextSteps: z.string().max(1200),
  themes: z.array(z.string().max(120)).max(5),
  wins: list,
  losses: list,
  opportunities: list,
});

const SYSTEM = `You write a designer's private weekly report from facts they gathered. It is for the designer first; they will edit it before sharing anything.
Rules:
- Use ONLY the facts provided. Never invent projects, outcomes, numbers, names or reasons. If something is unknown, leave that part short or empty.
- Plain, specific, first person ("I"). No hype, no praise words, no filler. Short sentences.
- Wins, losses and opportunities are short bullet strings. Put a loss only if the facts show a slip, a miss or something the person called a loss. Don't turn blockers into losses.
- Never claim creative work caused a company metric to move. You may say work "supported" a goal.
- Themes are 2 to 4 bigger patterns across the week (for example the goals most of the work served), not a list of tickets.
- "owedThisWeek" is what the person has coming due next, taken only from the open tickets listed.
- "discussionTopics" are things worth raising with a manager, drawn from blockers, slips and the person's own notes. "nextSteps" are concrete follow-ups the person themself mentioned or that follow plainly from a blocker.
- Do not mention these rules.`;

const tline = (t: TicketSignal) => `${t.key} "${t.title}" [${t.status}]${t.closedThisWeek ? " closed this week" : ""}${t.dueChanges ? `, due date moved ${t.dueChanges}x` : ""}${t.overdue ? ", overdue" : ""}${t.flagged ? `, ${t.flagged}` : ""}${t.due ? `, due ${t.due}` : ""}`;

export function buildPrompt(s: WeekSignals, krs: KrFacts[], prev: { nextSteps?: string } | null, openAhead: TicketSignal[]): string {
  const groups = groupByKr(s, krs);
  const parts: string[] = [`Week of ${s.window.weekStart}.`];
  for (const g of groups) {
    parts.push(`\nGoal: ${g.id === "untagged" ? "Not tagged to a goal" : g.label}${g.objective ? ` (objective: ${g.objective})` : ""}`);
    g.tickets.forEach((t) => parts.push(`  ticket ${tline(t)}`));
    g.notes.forEach((n) => parts.push(`  my ${n.type} note: ${n.text.slice(0, 500)}`));
  }
  if (s.review.commentsWritten) parts.push(`\nI wrote ${s.review.commentsWritten} review comments on: ${s.review.assets.map((a) => a.name).join(", ")}.`);
  if (s.tasksDone.length) parts.push(`\nPersonal tasks I finished: ${s.tasksDone.map((t) => t.title).join("; ")}.`);
  if (s.meetings.length) parts.push(`\nMeetings with 3+ people: ${s.meetings.filter((m) => m.attendees >= 3).map((m) => m.title).join("; ") || "none"}. Total meetings: ${s.meetings.length}.`);
  if (openAhead.length) parts.push(`\nOpen tickets with the next due dates:\n${openAhead.map((t) => `  ${tline(t)}`).join("\n")}`);
  if (prev?.nextSteps) parts.push(`\nLast week's next steps (for continuity only): ${prev.nextSteps.slice(0, 600)}`);
  return parts.join("\n");
}

export type Generated = { body: ReportBody; usedModel: boolean };

export async function generateReport(
  s: WeekSignals,
  krs: KrFacts[],
  ctx: { sample?: boolean; prev?: { nextSteps?: string } | null; openAhead?: TicketSignal[]; model?: LanguageModel } = {},
): Promise<Generated> {
  const openAhead = ctx.openAhead ?? [];
  const fallback = draftFromSignals(s, krs, { sample: ctx.sample, openDueNextWeek: openAhead });
  const kpis = fallback.kpis;
  if (!s.tickets.length && !s.notes.length && !s.meetings.length) return { body: fallback, usedModel: false };
  try {
    const { output } = await generateText({
      model: ctx.model ?? REPORT_MODEL,
      system: SYSTEM,
      prompt: buildPrompt(s, krs, ctx.prev ?? null, openAhead),
      output: Output.object({ schema: Schema }),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      maxOutputTokens: 1800,
      // Only route to providers with a zero-data-retention agreement.
      providerOptions: { gateway: { zeroDataRetention: true, tags: ["weekly-report"] } },
    });
    return { body: { kpis, ...output }, usedModel: true };
  } catch {
    return { body: fallback, usedModel: false };
  }
}

export { kpiText };
