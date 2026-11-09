// Turns the rows of an OKR tab into KRs and initiatives. Pure (no network, no store) so it can be tested alone.
//
// The Sheet's tabs don't share one layout (the function tabs hold an OKR block and an initiative block, the
// R&D tab lists Objective > KR > Initiative in one table), so this finds header rows by their wording instead
// of by position, fills merged cells downwards, and reports what it couldn't place instead of guessing.
import type { Initiative, Kr, ParsedTab } from "./types";

type Field = "objective" | "kr" | "initiative" | "owner" | "success" | "milestone" | "baseline" | "target" | "current" | "unit" | "status";

const PATTERNS: [Field, RegExp][] = [
  ["objective", /^objectives?\b/],
  ["kr", /^(krs?|key results?)\b/],
  ["initiative", /^initiatives?\b/],
  ["owner", /^(owners?|drivers?)\b/],
  ["success", /^(success criteria|metrics?)\b/],
  ["milestone", /^milestones?\b/],
  ["baseline", /^baseline\b/],
  ["target", /^target\b/],
  ["current", /^(current|latest)\b/],
  ["unit", /^unit\b/],
  ["status", /^status\b/],
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
// Small FNV-1a hash (no Node crypto) so ids can be computed in the browser too. 8 hex chars is plenty for a few hundred KRs.
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
};
export const krId = (objective: string, kr: string) => `kr-${hash(`${norm(objective)}|${norm(kr)}`)}`;
const initiativeId = (kid: string | undefined, title: string) => `in-${hash(`${kid ?? ""}|${norm(title)}`)}`;

const fieldOf = (cell: string): Field | null => {
  const t = norm(cell);
  if (!t || t.length > 40) return null;
  return PATTERNS.find(([, re]) => re.test(t))?.[0] ?? null;
};

/** A header row names at least two known columns, one of them objective, KR or initiative. */
function headerMap(row: string[]): Map<Field, number> | null {
  const map = new Map<Field, number>();
  row.forEach((c, i) => {
    const f = fieldOf(c);
    if (f && !map.has(f)) map.set(f, i);
  });
  const anchor = map.has("objective") || map.has("kr") || map.has("initiative");
  return anchor && map.size >= 2 ? map : null;
}

const clip = (s: string | undefined, n: number) => {
  const t = (s ?? "").replace(/\r/g, "").trim();
  return t ? t.slice(0, n) : undefined;
};

export function parseOkrTab(tab: string, rows: string[][]): ParsedTab {
  const krs = new Map<string, Kr>();
  const initiatives: Initiative[] = [];
  const warnings: string[] = [];

  let cols: Map<Field, number> | null = null;
  let objective = "";
  let kr = "";
  let blocks = 0;

  const addKr = (k: Kr) => {
    const cur = krs.get(k.id);
    if (!cur) { krs.set(k.id, k); return; }
    for (const key of ["owner", "baseline", "target", "current", "unit", "status"] as const) cur[key] ??= k[key];
  };

  rows.forEach((row, r) => {
    const header = headerMap(row);
    if (header) { cols = header; objective = ""; kr = ""; blocks++; return; }
    if (!cols) return;
    const get = (f: Field) => {
      const i = cols!.get(f);
      return i === undefined ? "" : String(row[i] ?? "").trim();
    };
    if (row.every((c) => !String(c ?? "").trim())) return;

    const o = get("objective");
    const k = get("kr");
    const init = get("initiative");
    const hasOthers = [k, init, get("owner"), get("success"), get("milestone"), get("baseline"), get("target"), get("current")].some(Boolean);

    if (o && norm(o) !== norm(objective)) { objective = o; kr = ""; }
    if (o && !hasOthers) return; // a section row such as "WIN AT EX"
    if (k) kr = k;
    if (!kr && !init) return;

    const kid = kr ? krId(objective, kr) : undefined;
    if (kr) {
      addKr({
        id: kid!, objective, kr, tab,
        owner: clip(cols.has("initiative") ? undefined : get("owner"), 120),
        baseline: clip(get("baseline"), 80), target: clip(get("target"), 80), current: clip(get("current"), 80),
        unit: clip(get("unit"), 20), status: clip(get("status"), 40),
      });
    }
    if (init) {
      const [first, ...rest] = init.split("\n");
      const title = first.trim().slice(0, 200);
      if (!kid) warnings.push(`${tab} row ${r + 1}: initiative "${title.slice(0, 60)}" has no KR in or above it.`);
      initiatives.push({
        id: initiativeId(kid, title), krId: kid, objective, kr, title,
        detail: clip(rest.join("\n"), 1200),
        owner: clip(get("owner"), 120), successCriteria: clip(get("success"), 1200), milestones: clip(get("milestone"), 1200), status: clip(get("status"), 40),
        tab,
      });
    }
  });

  if (!blocks) warnings.push(`${tab}: no header row found (looked for Objective, KR, Initiative…).`);
  else if (!krs.size && !initiatives.length) warnings.push(`${tab}: found headers but no filled-in rows yet.`);
  return { krs: [...krs.values()], initiatives, warnings };
}

export function mergeParsed(parts: ParsedTab[]): ParsedTab {
  const krs = new Map<string, Kr>();
  const initiatives = new Map<string, Initiative>();
  const warnings: string[] = [];
  for (const p of parts) {
    for (const k of p.krs) if (!krs.has(k.id)) krs.set(k.id, k);
    for (const i of p.initiatives) if (!initiatives.has(i.id)) initiatives.set(i.id, i);
    warnings.push(...p.warnings);
  }
  return { krs: [...krs.values()], initiatives: [...initiatives.values()], warnings };
}
