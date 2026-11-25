// Builds public/library/detailed-icons.json from a folder of master SVGs (one per icon, named like fresh-ideas.svg).
// Run: node scripts/build-detailed-icons.mjs <folder of svgs>
//
// The masters are the "color=primary, size=large, saturation=normal, light" variants of the WDS Icons file in Figma
// (GmYpTremTiWY3HjIV0KzRE). That file isn't exportable through Figma's API, so the SVGs come from Figma's own export or
// its MCP server. Each master is drawn with three paints, which are swapped for tokens here so the library can recolor them:
//   #464543  line     the outlines
//   #82807D  mid      a fixed gray
//   anything else     accent  (Primary is #08794A)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("Usage: node scripts/build-detailed-icons.mjs <folder of svgs>"); process.exit(1); }

const LINE = "#464543", MID = "#82807D";
const norm = (h) => { h = h.toUpperCase(); return h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h; };

function clean(svg, name) {
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 64 64";
  const others = new Map();
  const inner = svg
    .replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    .replace(/<\/?g[^>]*>/g, "")
    // Inline styles go everywhere. Ids stay only where something refers to them (masks, clips, gradients, filters), made
    // unique per icon so two icons on one page can't collide; a nested <svg> (a composite icon) keeps its sizing attributes.
    .replace(/\sstyle="[^"]*"/g, "")
    .replace(/<(path|rect|circle|ellipse|line|polyline|polygon|text)([^>]*)>/g, (_, tag, attrs) => `<${tag}${attrs.replace(/\sid="[^"]*"/g, "")}>`)
    .replace(/<svg([^>]*)>/g, (_, attrs) => `<svg${attrs.replace(/\s(id|xmlns|fill)="[^"]*"/g, "")}>`)
    .replace(/\sid="([^"]+)"/g, (_, id) => ` id="${name}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${name}-${id})`)
    .replace(/(xlink:)?href="#([^"]+)"/g, (_, x, id) => `href="#${name}-${id}"`)
    .replace(/(fill|stroke)="(#[0-9A-Fa-f]{3,8})"/g, (_, attr, hex) => {
      const h = norm(hex);
      if (h === LINE) return `${attr}="{{line}}"`;
      if (h === MID) return `${attr}="{{mid}}"`;
      others.set(h, (others.get(h) ?? 0) + 1);
      return `${attr}="{{accent}}"`;
    })
    .replace(/\s+/g, " ").trim();
  return { vb, svg: inner, accents: [...others.keys()], hasDefs: /<defs|<clipPath|<mask|<use|<linearGradient/.test(inner) };
}

const files = readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
const icons = [], report = { accents: new Map(), defs: [], noAccent: [] };
for (const f of files) {
  const name = basename(f, ".svg");
  const c = clean(readFileSync(join(dir, f), "utf8"), name);
  for (const a of c.accents) report.accents.set(a, (report.accents.get(a) ?? 0) + 1);
  if (c.hasDefs) report.defs.push(name);
  if (!c.accents.length) report.noAccent.push(name);
  icons.push({ name, vb: c.vb, svg: c.svg, ...(c.accents[0] && c.accents[0] !== "#08794A" ? { a: c.accents[0] } : {}) });
}
mkdirSync("public/library", { recursive: true });
writeFileSync("public/library/detailed-icons.json", JSON.stringify({ generated: new Date().toISOString(), source: "figma:GmYpTremTiWY3HjIV0KzRE", icons }));
console.log(`wrote ${icons.length} icons`);
console.log("accent colors seen:", [...report.accents].map(([h, n]) => `${h} x${n}`).join(", "));
if (report.noAccent.length) console.log("no accent paint:", report.noAccent.join(", "));
if (report.defs.length) console.log("uses defs/clips/masks:", report.defs.join(", "));
