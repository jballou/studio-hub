// Run: node --test scripts/me-report.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { draftFromSignals, kpiText } from "../lib/me/reportDraft.ts";
import { buildPrompt, generateReport } from "../lib/me/reportAgent.ts";
import { weekWindow } from "../lib/me/week.ts";

const t = (key: string, o: object = {}) => ({ key, title: `Title ${key}`, status: "In Progress", done: false, moves: [], closedThisWeek: false, dueChanges: 0, overdue: false, ...o });
const n = (type: string, text: string, o: object = {}) => ({ id: text, type, text, at: "2026-11-10T10:00:00Z", visibility: "private", source: "manual", ...o });
const week = (o: object = {}) => ({ window: weekWindow("2026-11-09"), tickets: [], review: { commentsWritten: 0, assets: [] }, tasksDone: [], notes: [], meetings: [], sources: {}, ...o }) as never;
const krs = [{ id: "kr-aaaaaaaa", kr: "Net new EX accounts", objective: "Win in employee experience", baseline: "0", current: "120", target: "500" }];

const ok = (obj: unknown) => new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: "text", text: JSON.stringify(obj) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } },
    warnings: [],
  }),
});
const modelOut = { whyItMoved: "Most work served EX.", owedThisWeek: "A-2 due Friday", blockers: "", discussionTopics: "", nextSteps: "", themes: ["EX launch"], wins: ["Shipped A-1"], losses: [], opportunities: [] };

test("KPI text comes from the mirror and Jira, and flags sample data", () => {
  const s = week({ tickets: [t("A-1", { krId: "kr-aaaaaaaa" }), t("A-2", { krNone: true }), t("A-3")] });
  const txt = kpiText(s, krs, true);
  assert.match(txt, /^Sample goals/);
  assert.match(txt, /Net new EX accounts: now 120 \(baseline 0, target 500\)\. Supported by 1 project/);
  assert.match(txt, /Business as usual: 1 project/);
  assert.match(txt, /Not tagged to a KR: 1 project/);
  assert.equal(kpiText(week(), krs), "");
});

test("facts-only draft: wins, slips, blockers and notes land in the right fields", () => {
  const s = week({
    tickets: [t("A-1", { closedThisWeek: true, krId: "kr-aaaaaaaa" }), t("A-2", { dueChanges: 2 }), t("A-3", { flagged: "blocked" })],
    notes: [n("win", "Client loved it"), n("blocker", "Waiting on legal"), n("opportunity", "Template kit"), n("one_on_one", "Ask about travel")],
  });
  const d = draftFromSignals(s, krs, { openDueNextWeek: [t("A-9", { due: "2026-11-20" })] as never });
  assert.deepEqual(d.wins, ["Shipped A-1 Title A-1", "Client loved it"]);
  assert.match(d.losses[0], /A-2.*ran late.*2×/);
  assert.match(d.blockers, /A-3.*blocked/);
  assert.match(d.blockers, /Waiting on legal/);
  assert.deepEqual(d.opportunities, ["Template kit"]);
  assert.match(d.discussionTopics, /travel/);
  assert.match(d.owedThisWeek, /A-9.*2026-11-20/);
  assert.deepEqual(d.themes, ["Win in employee experience"]);
  // two KRs under one objective make one theme, not two
  const two = [...krs, { id: "kr-bbbbbbbb", kr: "EX leads", objective: "Win in employee experience" }];
  const d2 = draftFromSignals(week({ tickets: [t("A-1", { krId: "kr-aaaaaaaa" }), t("A-2", { krId: "kr-bbbbbbbb" })] }), two);
  assert.deepEqual(d2.themes, ["Win in employee experience"]);
});

test("the model writes the narrative but never the KPI numbers", async () => {
  const s = week({ tickets: [t("A-1", { krId: "kr-aaaaaaaa", closedThisWeek: true })] });
  const r = await generateReport(s, krs, { model: ok({ ...modelOut, kpis: "Net new EX accounts: now 9,999" }) });
  assert.equal(r.usedModel, true);
  assert.equal(r.body.wins[0], "Shipped A-1");
  assert.match(r.body.kpis, /now 120/);
  assert.doesNotMatch(r.body.kpis, /9,999/);
});

test("model failure or junk output returns the facts-only draft", async () => {
  const s = week({ tickets: [t("A-1", { closedThisWeek: true })] });
  const boom = await generateReport(s, krs, { model: new MockLanguageModelV4({ doGenerate: async () => { throw new Error("down"); } }) });
  assert.equal(boom.usedModel, false);
  assert.match(boom.body.wins[0], /Shipped A-1/);
  const junk = await generateReport(s, krs, { model: ok({ wins: 5 }) });
  assert.equal(junk.usedModel, false);
});

test("an empty week skips the model", async () => {
  const boom = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("should not be called"); } });
  const r = await generateReport(week(), krs, { model: boom });
  assert.equal(r.usedModel, false);
});

test("the prompt carries goals, tickets, notes and last week's next steps, and nothing else", () => {
  const s = week({ tickets: [t("A-1", { krId: "kr-aaaaaaaa", dueChanges: 1 })], notes: [n("blocker", "Waiting on legal", { krId: "kr-aaaaaaaa" })] });
  const p = buildPrompt(s, krs, { nextSteps: "Send the deck" }, [t("A-9", { due: "2026-11-20" })] as never);
  assert.match(p, /Goal: Net new EX accounts/);
  assert.match(p, /A-1 "Title A-1".*due date moved 1x/);
  assert.match(p, /my blocker note: Waiting on legal/);
  assert.match(p, /Send the deck/);
  assert.match(p, /A-9/);
});

test("MarCo export lays out the columns and skips empty ones", async () => {
  const { marcoText } = await import("../lib/me/export.ts");
  const body = { kpis: "Net new EX: now 120", whyItMoved: "Most work served EX.", owedThisWeek: "", blockers: "A-3 blocked", discussionTopics: "", nextSteps: "Send deck", themes: [], wins: ["Shipped A-1"], losses: ["A-2 ran late"], opportunities: [] };
  const txt = marcoText(body, "Nov 9");
  assert.match(txt, /^Brand Creative, week of Nov 9/);
  assert.match(txt, /Top 2 KPIs & Performance\nNet new EX: now 120/);
  assert.match(txt, /Wins\n• Shipped A-1/);
  assert.match(txt, /Misses\n• A-2 ran late/);
  assert.doesNotMatch(txt, /This week: what we owe/);
  assert.doesNotMatch(txt, /Proposed discussion topics/);
});
