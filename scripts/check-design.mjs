// Design guardrails: spacing sits on an 8px grid and type uses only the scale in app/globals.css.
// Run: npm run check:design   (exits 1 and lists every offender)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["components", "app"];
// Tailwind spacing units are 4px, so an even number is a multiple of 8px. "px" (1px) and 0 are fine.
const SPACING = /(?<![\w-])-?(?:gap-x|gap-y|space-x|space-y|gap|px|py|pt|pb|pl|pr|ps|pe|p|mx|my|mt|mb|ml|mr|ms|me|m)-(\d+(?:\.\d+)?|\[[^\]]+\])(?![\w.\]/-])/g;
const SIZES = new Set(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "headline-lg", "display-md", "display-lg"]);
const TEXT = /(?<![\w-])text-(\[[^\]]+\]|[a-z0-9-]+)(?![\w-])/g;
const COLOR_WORDS = /^(ink|muted|brand|brand-dark|brand-soft|brand-fill|n-\d+|white|bad-fg|ok-fg|warn-fg|info-fg|progress-fg|gold-fg|bad|ok|warn|info|gold|current|inherit|transparent|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|foreground|background|control|line|focus|link|card|surface|paper|n-50|n-100|n-150|n-200)$/;

const bad = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) check(p);
  }
};
function check(file) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(SPACING)) {
      const v = m[1];
      if (v.startsWith("[")) { if (!/^\[\d+(vh|vw|%|rem)\]$/.test(v) && !/^\[(0|0px)\]$/.test(v)) bad.push(`${file}:${i + 1}  ${m[0]}  (arbitrary spacing)`); continue; }
      const n = Number(v);
      if (n !== 0 && n % 2 !== 0) bad.push(`${file}:${i + 1}  ${m[0]}  (${n * 4}px is not a multiple of 8)`);
    }
    for (const m of line.matchAll(TEXT)) {
      const v = m[1];
      if (SIZES.has(v) || COLOR_WORDS.test(v) || /^(bad|ok|warn|info|progress|gold)-/.test(v)) continue;
      if (/^\[[\d.]+em\]$/.test(v)) continue; // relative to the surrounding text, e.g. inline code
      if (v.startsWith("[")) bad.push(`${file}:${i + 1}  ${m[0]}  (use a size from the type scale)`);
    }
  });
}
for (const r of ROOTS) walk(r);
if (bad.length) { console.error(`${bad.length} design guardrail problem(s):\n` + bad.join("\n")); process.exit(1); }
console.log("Design check passed: spacing is on the 8px grid and type uses the scale.");
