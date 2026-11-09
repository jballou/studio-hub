// Run: node --test scripts/okr-parse.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeParsed, parseOkrTab } from "../lib/okr/parse.ts";

test("R&D-style table: section row, KR, initiative with detail", () => {
  const rows = [
    ["Objective", "KR", "Initiative", "Owner", "Success Criteria", "Milestone"],
    ["WIN AT EX", "", "", "", "", ""],
    ["Win at EX", "Net New EX accounts", "Expand HRIS systems we connect to\nWhy it works: less setup friction.", "", "Share of EX base on HRIS: 0% -> 40%", "Q1: rank systems"],
    ["", "", "Add triggered surveys", "Sam", "Live accounts: 0 -> 50", "Q2: pilot"],
  ];
  const p = parseOkrTab("R&D", rows);
  assert.equal(p.krs.length, 1);
  assert.equal(p.krs[0].kr, "Net New EX accounts");
  assert.equal(p.initiatives.length, 2);
  assert.equal(p.initiatives[0].title, "Expand HRIS systems we connect to");
  assert.match(p.initiatives[0].detail ?? "", /less setup friction/);
  // second initiative inherits the KR from the merged cell above
  assert.equal(p.initiatives[1].krId, p.krs[0].id);
  assert.equal(p.warnings.length, 0);
});

test("OKR block with baseline, target and current", () => {
  const rows = [
    ["Function plan"],
    ["Objective", "Key Result", "Baseline", "Target", "Current"],
    ["Grow pipeline", "Marketing-sourced pipeline", "$10M", "$14M", "$11M"],
    ["", "MQLs per week", "300", "400", "310"],
  ];
  const p = parseOkrTab("Marketing", rows);
  assert.equal(p.krs.length, 2);
  assert.equal(p.krs[0].target, "$14M");
  assert.equal(p.krs[1].objective, "Grow pipeline");
});

test("KR ids are stable and survive spacing and case changes", () => {
  const a = parseOkrTab("A", [["Objective", "KR"], ["Win", "Net  New accounts"]]).krs[0].id;
  const b = parseOkrTab("B", [["Objective", "KR"], ["win", "net new accounts"]]).krs[0].id;
  assert.equal(a, b);
  assert.match(a, /^kr-[0-9a-f]{8}$/);
});

test("empty template reports instead of guessing", () => {
  const p = parseOkrTab("Marketing", [["Function — FY27 Plan"], ["A: your function OKRs..."], ["", ""]]);
  assert.equal(p.krs.length, 0);
  assert.match(p.warnings[0], /no header row/);
});

test("initiative with no KR is flagged", () => {
  const p = parseOkrTab("XFN", [["Initiative", "Owner"], ["Ship thing", "Sam"]]);
  assert.equal(p.initiatives.length, 1);
  assert.equal(p.initiatives[0].krId, undefined);
  assert.match(p.warnings[0], /no KR/);
});

test("merge de-duplicates across tabs", () => {
  const t = [["Objective", "KR"], ["Win", "Same KR"]];
  const m = mergeParsed([parseOkrTab("A", t), parseOkrTab("B", t)]);
  assert.equal(m.krs.length, 1);
});

test("sample rows parse into linked KRs and initiatives with no warnings", async () => {
  const { OKR_ROWS, INITIATIVE_ROWS } = await import("../lib/okr/sampleRows.ts");
  const m = mergeParsed([parseOkrTab("Sample", OKR_ROWS), parseOkrTab("Sample", INITIATIVE_ROWS)]);
  assert.equal(m.krs.length, 6);
  assert.equal(m.initiatives.length, 6);
  assert.ok(m.initiatives.every((i) => i.krId && m.krs.some((k) => k.id === i.krId)));
  assert.equal(m.warnings.length, 0);
});
