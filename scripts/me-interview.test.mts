// Run: node --test scripts/me-interview.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { askNext } from "../lib/me/interviewAgent.ts";
import { findGaps, plainNext, remainingGaps } from "../lib/me/interview.ts";
import { weekWindow } from "../lib/me/week.ts";

const t = (key: string, o: object = {}) => ({ key, title: `Title ${key}`, status: "In Progress", done: false, moves: [], closedThisWeek: false, dueChanges: 0, overdue: false, ...o });
const week = (o: object = {}) => ({
  window: weekWindow("2026-11-09"), tickets: [], review: { commentsWritten: 0, assets: [] }, tasksDone: [], notes: [], meetings: [],
  sources: {}, ...o,
}) as never;
const mockModel = (obj: unknown) => new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } },
    warnings: [],
  }),
});

test("slips, blockers and shipped work become gaps, most urgent first", () => {
  const g = findGaps(week({ tickets: [t("A-1", { dueChanges: 1 }), t("A-2", { flagged: "blocked" }), t("A-3", { closedThisWeek: true })] }));
  assert.deepEqual(g.slice(0, 3).map((x) => x.id), ["slipped:A-1", "flagged:A-2", "closed:A-3"]);
  assert.ok(g.every((x) => x.question && x.evidence));
});

test("a quiet week asks what happened instead of nothing", () => {
  assert.equal(findGaps(week())[0].id, "quiet");
});

test("big untied meetings are asked about; ones naming a ticket are not", () => {
  const m = (title: string, attendees: number) => ({ title, start: "2026-11-10T15:00:00Z", end: "2026-11-10T16:00:00Z", attendees });
  const ids = findGaps(week({ tickets: [t("A-1")], meetings: [m("EX launch sync", 6), m("A-1 review", 5), m("1:1", 2)] })).filter((g) => g.kind === "meeting");
  assert.equal(ids.length, 1);
  assert.match(ids[0].question, /EX launch sync/);
});

test("standard prompts are skipped when the week already covers them", () => {
  const n = (type: string) => ({ id: type, type, text: "x", at: "2026-11-10T10:00:00Z", visibility: "private", source: "manual" });
  const ids = findGaps(week({ tickets: [t("A-1")], notes: [n("win"), n("growth"), n("opportunity")] })).map((g) => g.id);
  assert.ok(!ids.includes("win") && !ids.includes("feedback") && !ids.includes("opportunity"));
  assert.ok(ids.includes("workload"));
});

test("never more than eight questions", () => {
  const many = Array.from({ length: 20 }, (_, i) => t(`A-${i}`, { dueChanges: 1, flagged: "blocked", closedThisWeek: true }));
  assert.ok(findGaps(week({ tickets: many })).length <= 8);
});

test("plainNext walks the list and ends", () => {
  const gaps = findGaps(week());
  const first = plainNext(gaps, [])!;
  assert.equal(first.gapId, gaps[0].id);
  assert.equal(plainNext(gaps, gaps.map((g) => g.id)), null);
  assert.equal(remainingGaps(gaps, [gaps[0].id]).length, gaps.length - 1);
});

test("the model can pick and rephrase, but only among real gaps", async () => {
  const gaps = findGaps(week({ tickets: [t("A-1", { dueChanges: 1 }), t("A-2", { flagged: "blocked" })] }));
  const good = await askNext(gaps, [], [], { model: mockModel({ action: "ask", gapId: "flagged:A-2", question: "What would unblock A-2?", chips: ["A person", "An asset", "", "x"] }) });
  assert.equal(good.usedModel, true);
  assert.equal(good.next?.gapId, "flagged:A-2");
  assert.deepEqual(good.next?.chips, ["A person", "An asset", "x"]);
  const invented = await askNext(gaps, [], [], { model: mockModel({ action: "ask", gapId: "made-up", question: "Tell me about your salary", chips: [] }) });
  assert.equal(invented.usedModel, false);
  assert.equal(invented.next?.gapId, gaps[0].id);
});

test("a model failure or bad output falls back to the plain question", async () => {
  const gaps = findGaps(week({ tickets: [t("A-1", { dueChanges: 1 })] }));
  const boom = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("gateway down"); } });
  const r1 = await askNext(gaps, [], [], { model: boom });
  assert.equal(r1.usedModel, false);
  assert.equal(r1.next?.question, gaps[0].question);
  const r2 = await askNext(gaps, [], [], { model: mockModel("not json") });
  assert.equal(r2.usedModel, false);
});

test("the model may end early, but only after a few answers", async () => {
  const gaps = findGaps(week({ tickets: [t("A-1", { dueChanges: 1 }), t("A-2", { flagged: "blocked" })] }));
  const done = mockModel({ action: "done", gapId: "", question: "", chips: [] });
  const early = await askNext(gaps, ["slipped:A-1"], [{ gapId: "slipped:A-1", answer: "feedback delays" }], { model: done });
  assert.ok(early.next, "one answer is too early to stop");
  const later = await askNext(gaps, ["slipped:A-1", "flagged:A-2", "x"], [1, 2, 3].map((i) => ({ gapId: `g${i}`, answer: "a" })), { model: done });
  assert.equal(later.next, null);
});

test("with one gap left and no history the model is skipped", async () => {
  const gaps = findGaps(week()).slice(0, 1);
  const boom = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("should not be called"); } });
  const r = await askNext(gaps, [], [], { model: boom });
  assert.equal(r.next?.gapId, gaps[0].id);
});
