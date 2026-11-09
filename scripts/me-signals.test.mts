// Run: node --test scripts/me-signals.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { counts, groupByKr } from "../lib/me/signals.ts";
import { inWindow, weekStartOf, weekWindow } from "../lib/me/week.ts";

test("weekStartOf returns the Monday on or before", () => {
  assert.equal(weekStartOf("2026-11-09"), "2026-11-09"); // Monday
  assert.equal(weekStartOf("2026-11-15"), "2026-11-09"); // Sunday
  assert.equal(weekStartOf("2026-11-11"), "2026-11-09");
  assert.equal(weekStartOf("2026-01-01"), "2025-12-29"); // across a year
});

test("window is seven days and half-open", () => {
  const w = weekWindow("2026-11-09");
  assert.equal(w.weekEnd, "2026-11-16");
  assert.equal(inWindow("2026-11-09T00:00:00.000Z", w), true);
  assert.equal(inWindow("2026-11-15T23:59:59.000Z", w), true);
  assert.equal(inWindow("2026-11-16T00:00:00.000Z", w), false);
  assert.equal(inWindow(undefined, w), false);
});

const t = (key: string, o: object = {}) => ({ key, title: key, status: "In Progress", done: false, moves: [], closedThisWeek: false, dueChanges: 0, overdue: false, ...o });
const n = (id: string, o: object = {}) => ({ id, type: "win", text: id, at: "2026-11-10T10:00:00.000Z", visibility: "private", source: "manual", ...o });
const krs = [{ id: "kr-aaaaaaaa", kr: "Net new accounts", objective: "Win" }];

test("groups by KR with business-as-usual and untagged kept visible", () => {
  const g = groupByKr({ tickets: [t("A-1", { krId: "kr-aaaaaaaa" }), t("A-2", { krNone: true }), t("A-3"), t("A-4", { krId: "kr-aaaaaaaa" })] as never, notes: [n("n1", { krId: "kr-aaaaaaaa" }), n("n2")] as never }, krs);
  assert.deepEqual(g.map((x) => x.id), ["kr-aaaaaaaa", "none", "untagged"]);
  assert.equal(g[0].tickets.length, 2);
  assert.equal(g[0].notes.length, 1);
  assert.equal(g[0].label, "Net new accounts");
  assert.equal(g[2].notes.length, 1);
});

test("a KR missing from the sheet is labelled, not dropped", () => {
  const g = groupByKr({ tickets: [t("A-1", { krId: "kr-bbbbbbbb" })] as never, notes: [] }, krs);
  assert.match(g[0].label, /no longer/);
});

test("counts flag slips and untagged work", () => {
  const s = { window: weekWindow("2026-11-09"), tickets: [t("A-1", { dueChanges: 1 }), t("A-2", { overdue: true, krNone: true }), t("A-3", { closedThisWeek: true, krId: "kr-aaaaaaaa", flagged: "blocked" })], notes: [n("x")], meetings: [], tasksDone: [] } as never;
  const c = counts(s);
  assert.equal(c.slipped, 2);
  assert.equal(c.closed, 1);
  assert.equal(c.untagged, 1);
  assert.equal(c.flagged, 1);
});
