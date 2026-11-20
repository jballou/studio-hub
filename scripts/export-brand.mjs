// Exports brand assets from the Project Catalyst Figma file into the repo.
// Run: node --env-file=.env.local scripts/export-brand.mjs [icons|logos|colors|all]
//      node --env-file=.env.local scripts/export-brand.mjs photos <destination folder> [--dry]   (photography, as files, into a Drive folder)
// Needs FIGMA_ACCESS_TOKEN (file read). Re-run any time the Figma file changes; output is overwritten.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "CzW7fiCLPbvpOisNRxI7TG";
const TOKEN = process.env.FIGMA_ACCESS_TOKEN;
if (!TOKEN) { console.error("FIGMA_ACCESS_TOKEN is not set."); process.exit(1); }
const what = process.argv[2] ?? "all";

const api = async (path) => {
  const r = await fetch(`https://api.figma.com/v1${path}`, { headers: { "X-Figma-Token": TOKEN } });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
};

/** Signed SVG urls for node ids, in batches. */
async function svgUrls(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const j = await api(`/images/${FILE}?ids=${encodeURIComponent(batch.join(","))}&format=svg&svg_outline_text=true&svg_include_id=false`);
    Object.assign(out, j.images);
  }
  return out;
}
const fetchText = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url} -> ${r.status}`); return r.text(); };

/** One-colour UI icon: drop clip paths and inline styles, paint with currentColor, keep only the shapes. */
function cleanIcon(svg) {
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 14 14";
  // A few icons (chart-donut-filled) draw an inside stroke with <use> and <mask>, which need their <defs> kept.
  const keepDefs = /<use[\s>]/.test(svg);
  const inner = svg
    .replace(/<clipPath[\s\S]*?<\/clipPath>/g, "")
    .replace(keepDefs ? /$^/ : /<defs>[\s\S]*?<\/defs>/g, "").replace(/<\/?g[^>]*>/g, "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "")
    .replace(/xlink:href=/g, "href=")
    .replace(/\sclip-path="[^"]*"/g, "").replace(/\sstyle="[^"]*"/g, "")
    .replace(/(fill|stroke)="#[0-9A-Fa-f]{3,8}"/g, '$1="currentColor"').replace(/\s+/g, " ").trim();
  return { vb, inner };
}

async function icons() {
  const j = await api(`/files/${FILE}/nodes?ids=${encodeURIComponent("6022:2756")}&depth=3`);
  const frame = j.nodes["6022:2756"].document;
  // Figma names are mixed (contactGroup, icon_warning); the library uses lower-case kebab-case.
  const tidy = (n) => n.replace(/^icon[_-]/i, "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[_\s]+/g, "-").toLowerCase();
  const items = frame.children.map((c) => c.children?.[0]).filter(Boolean).map((n) => ({ id: n.id, name: tidy(n.name) }));
  console.log(`icons: ${items.length} found`);
  const urls = await svgUrls(items.map((i) => i.id));
  const manifest = [];
  for (const it of items) {
    if (!urls[it.id]) { console.warn(`  no render for ${it.name}`); continue; }
    const { vb, inner } = cleanIcon(await fetchText(urls[it.id]));
    manifest.push({ name: it.name, vb, svg: inner });
  }
  manifest.sort((a, b) => a.name.localeCompare(b.name));
  mkdirSync("public/library", { recursive: true });
  writeFileSync("public/library/icons.json", JSON.stringify({ generated: new Date().toISOString(), source: `figma:${FILE}:6022:2756`, icons: manifest }));
  console.log(`icons: wrote ${manifest.length} to public/library/icons.json`);
}

// Logo components (id -> file name). Full-colour vectors, kept as drawn.
const LOGOS = {
  "2165:97998": "surveymonkey/primary-green", "2165:97981": "surveymonkey/primary-black", "2165:97979": "surveymonkey/primary-white", "3714:159032": "surveymonkey/primary-muted",
  "3714:159167": "surveymonkey/secondary-green", "3714:159163": "surveymonkey/secondary-black", "3714:159159": "surveymonkey/secondary-white", "3714:159034": "surveymonkey/secondary-muted",
  "2165:98009": "surveymonkey/logomark-green", "3714:159107": "surveymonkey/logomark-black", "3714:159127": "surveymonkey/logomark-white", "3714:159147": "surveymonkey/logomark-muted",
  "7139:2794": "launchpad/primary-light", "7139:2790": "launchpad/primary-muted", "7139:2791": "launchpad/primary-dark", "7139:2789": "launchpad/primary-periwinkle",
  "7139:2796": "launchpad/secondary-light", "7139:2795": "launchpad/secondary-muted", "7139:2792": "launchpad/secondary-dark", "7139:2799": "launchpad/secondary-periwinkle",
  "7139:2800": "launchpad/mark-light", "7139:2798": "launchpad/mark-muted", "7139:2793": "launchpad/mark-dark", "7139:2797": "launchpad/mark-periwinkle",
  "8345:5528": "getfeedback/logo-color", "8345:5550": "getfeedback/logo-white", "8345:5546": "getfeedback/symbol-color", "8345:5548": "getfeedback/symbol-white",
};

async function logos() {
  const ids = Object.keys(LOGOS);
  const urls = await svgUrls(ids);
  const manifest = [];
  for (const id of ids) {
    if (!urls[id]) { console.warn(`  no render for ${LOGOS[id]}`); continue; }
    const [brand, file] = LOGOS[id].split("/");
    mkdirSync(`public/library/logos/${brand}`, { recursive: true });
    const svg = await fetchText(urls[id]);
    writeFileSync(`public/library/logos/${brand}/${file}.svg`, svg);
    const [kind, ...v] = file.split("-");
    manifest.push({ id, brand, kind, variant: v.join("-"), path: `/library/logos/${brand}/${file}.svg`, w: Number(/width="([\d.]+)"/.exec(svg)?.[1]) || null, h: Number(/height="([\d.]+)"/.exec(svg)?.[1]) || null });
  }
  writeFileSync("public/library/logos.json", JSON.stringify({ generated: new Date().toISOString(), logos: manifest }, null, 1));
  console.log(`logos: wrote ${manifest.length}`);
}

/** Swatches from the "All colors" frame: hex, RGB, CMYK and Pantone as the brand team wrote them. */
async function colors() {
  const j = await api(`/files/${FILE}/nodes?ids=${encodeURIComponent("6031:8878")}&depth=6`);
  const frame = j.nodes["6031:8878"].document;
  const texts = (n, a = []) => { if (n.type === "TEXT") a.push(n.characters); (n.children ?? []).forEach((c) => texts(c, a)); return a; };
  const families = new Map();
  for (const col of frame.children) {
    for (const sw of col.children ?? []) {
      const t = texts(sw);
      const hex = t.find((x) => /^#[0-9A-Fa-f]{6}$/.test(x));
      const label = t.find((x) => /\n\d+$/.test(x));
      if (!hex || !label) continue;
      const [family, step] = label.split("\n");
      const get = (re) => t.find((x) => re.test(x));
      const pms = get(/^(PMS:\s*)?\d{3,4}c$|^PMS:/)?.replace(/^PMS:\s*/, "") ?? "";
      const list = families.get(family) ?? [];
      list.push({ name: `${family} ${step}`, step: Number(step), hex: hex.toUpperCase(), rgb: get(/^R:/)?.replace(/\s*\/\s*/g, ", ") ?? "", cmyk: get(/^C:/)?.replace(/\s*\/\s*/g, ", ") ?? "", pms: pms === "N/A" || pms === "000" ? "" : pms });
      families.set(family, list);
    }
  }
  const out = [...families].map(([name, shades]) => ({ name, shades: shades.sort((a, b) => a.step - b.step) }));
  writeFileSync("public/library/colors.json", JSON.stringify({ generated: new Date().toISOString(), families: out }, null, 1));
  console.log(`colors: ${out.length} families, ${out.reduce((n, f) => n + f.shades.length, 0)} shades`);
}

/**
 * Photography page (0:1): every visible layer with an image fill, saved as a file in a folder named after its section
 * (or, in the full-bleed library, after its category frame). Full-bleed photos are JPG; cut-outs are PNG for transparency.
 */
async function photos(dest, dry) {
  const j = await api(`/files/${FILE}/nodes?ids=${encodeURIComponent("0:1")}&depth=8`);
  const page = j.nodes["0:1"].document;
  const clean = (n) => n.replace(/[\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const hasImg = (n) => (n.fills ?? []).some((f) => f.type === "IMAGE" && f.visible !== false);
  const collect = (n, out = []) => { if (n.visible === false) return out; if (hasImg(n)) out.push(n); (n.children ?? []).forEach((c) => collect(c, out)); return out; };
  const jobs = [];
  for (const sec of page.children) {
    if (/guidelines/i.test(sec.name)) continue;
    const full = /full-bleed/i.test(sec.name);
    const fmt = full ? "jpg" : "png";
    // "PROFESSIONALS ON LAPTOPS" -> "Professionals on laptops", keeping HR, eNPS and CX as written.
    const sentence = (t) => t.toLowerCase().replace(/^./, (m) => m.toUpperCase()).replace(/\bhr\b/g, "HR").replace(/\benps\b/g, "eNPS").replace(/\bcx\b/g, "CX");
    const groupOf = (c) => full ? sentence(clean(c.name === "label" ? "" : c.name)) || "Uncategorized" : "";
    const base = full ? "Full-bleed" : /wide/i.test(sec.name) ? "Wide cut-outs" : "Cut-outs";
    for (const c of sec.children ?? []) {
      if (c.name === "label") continue;
      const folder = full && c.type === "FRAME" ? join(base, groupOf(c)) : full ? join(base, "Uncategorized") : base;
      for (const n of collect(c)) jobs.push({ id: n.id, name: clean(n.name) || n.id.replace(":", "-"), folder, fmt });
    }
  }
  // Same name twice in one folder gets -2, -3.
  const seen = new Map();
  for (const jb of jobs) { const k = `${jb.folder}/${jb.name}.${jb.fmt}`.toLowerCase(); const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); jb.file = join(jb.folder, n === 1 ? `${jb.name}.${jb.fmt}` : `${jb.name}-${n}.${jb.fmt}`); }
  const byFolder = {}; for (const jb of jobs) byFolder[jb.folder] = (byFolder[jb.folder] ?? 0) + 1;
  console.log(`photos: ${jobs.length} images`); console.table(byFolder);
  if (dry) return;
  mkdirSync(dest, { recursive: true });
  let done = 0, skipped = 0; const failed = [];
  for (const fmt of ["jpg", "png"]) {
    const set = jobs.filter((x) => x.fmt === fmt);
    for (let i = 0; i < set.length; i += 40) {
      const batch = set.slice(i, i + 40);
      const r = await api(`/images/${FILE}?ids=${encodeURIComponent(batch.map((x) => x.id).join(","))}&format=${fmt}&scale=2`);
      await Promise.all(batch.map(async (jb) => {
        const out = join(dest, jb.file);
        if (existsSync(out)) { skipped++; return; }
        const url = r.images[jb.id];
        if (!url) { failed.push(jb.file); return; }
        try { const res = await fetch(url); if (!res.ok) throw new Error(String(res.status)); mkdirSync(join(dest, jb.folder), { recursive: true }); writeFileSync(out, Buffer.from(await res.arrayBuffer())); done++; } catch { failed.push(jb.file); }
      }));
      console.log(`  ${fmt}: ${Math.min(i + 40, set.length)}/${set.length}`);
    }
  }
  console.log(`photos: wrote ${done}, already there ${skipped}, failed ${failed.length}`);
  if (failed.length) console.log(failed.join("\n"));
}

if (what === "photos") await photos(process.argv[3], process.argv.includes("--dry") || !process.argv[3]);
if (what === "icons" || what === "all") await icons();
if (what === "logos" || what === "all") await logos();
if (what === "colors" || what === "all") await colors();
