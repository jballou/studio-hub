// A report as plain text laid out like the MarCo weekly check-in columns, ready to paste into the Sheet.
import type { ReportBody } from "./types.ts";

const bullets = (xs: string[]) => xs.map((x) => `• ${x}`).join("\n");

export function marcoText(b: ReportBody, weekLabel: string): string {
  const parts: [string, string][] = [
    ["Top 2 KPIs & Performance", b.kpis],
    ["Last week: what led to the performance", [b.whyItMoved, b.wins.length ? `Wins\n${bullets(b.wins)}` : "", b.losses.length ? `Misses\n${bullets(b.losses)}` : ""].filter(Boolean).join("\n\n")],
    ["This week: what we owe", b.owedThisWeek],
    ["Issues & blockers", b.blockers],
    ["Proposed discussion topics", b.discussionTopics],
    ["Action / next steps", b.nextSteps],
  ];
  const body = parts.filter(([, v]) => v.trim()).map(([k, v]) => `${k}\n${v.trim()}`).join("\n\n");
  return `Brand Creative, week of ${weekLabel}\n\n${body}`.trim();
}
