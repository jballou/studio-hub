"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { copyText } from "@/lib/brand/download";
import { useColors, type Shade } from "@/lib/brand/data";

// Text color that stays readable on a swatch: the first of off-white, brand ink or black that reaches 4.5:1 (WCAG AA),
// or whichever is best when none do.
const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
const ratio = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const textOn = (hex: string) => {
  const options = ["#FEFDFB", "#0F2E21", "#000000"];
  return options.find((c) => ratio(c, hex) >= 4.5) ?? options.reduce((best, c) => (ratio(c, hex) > ratio(best, hex) ? c : best));
};

type Pair = [label: string, fg: string];
// Text colors that suit each background, from the brand's accessibility guidance in Figma. Ratios are worked out here from the hex values.
const D: Pair = ["Text color dark", "#0F2E21"], L: Pair = ["Text color light", "#FEFDFB"], MUTED: Pair = ["Text color muted", "#82807D"];
const BRAND: Pair = ["Text color brand", "#089B5E"], LINK: Pair = ["Hyperlink color", "#08794A"], LINK_LIGHT: Pair = ["Hyperlink color", "#D6F5DE"];
const AY6: Pair = ["Text color accent", "#A18102"], AP7: Pair = ["Text color accent", "#3F4D94"], AT7: Pair = ["Text color accent", "#348289"];
const AY4: Pair = ["Text color accent", "#E2BF36"], AP5: Pair = ["Text color accent", "#7084EB"], AT4: Pair = ["Text color accent", "#87D0D7"];
const LIGHT_SURFACE = [D, MUTED, BRAND, AY6, AP7, AT7, LINK];
const COMBOS: { name: string; bg: string; text: Pair[] }[] = [
  { name: "Neutral 50", bg: "#FEFDFB", text: LIGHT_SURFACE },
  { name: "Neutral 150", bg: "#EDEBE8", text: LIGHT_SURFACE },
  { name: "Green 900", bg: "#0F2E21", text: [L, MUTED, BRAND, AY4, AP5, AT4, LINK_LIGHT] },
  { name: "Green 500", bg: "#089B5E", text: [L, D, LINK_LIGHT] },
  { name: "Yellow 100", bg: "#F9F2D2", text: LIGHT_SURFACE },
  { name: "Yellow 300", bg: "#EBD370", text: [D, LINK] },
  { name: "Periwinkle 100", bg: "#EDEDFD", text: LIGHT_SURFACE },
  { name: "Periwinkle 600", bg: "#5566BF", text: [L, LINK_LIGHT] },
  { name: "Teal 200", bg: "#C5E8EB", text: [D, MUTED, AP7, AT7, LINK] },
  { name: "Teal 400", bg: "#87D0D7", text: [D, LINK] },
];
const grade = (r: number) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "Large text" : "Fails");

export function ColorsView() {
  const { data, error } = useColors();
  const [copied, setCopied] = useState<string | null>(null);
  const [q, setQ] = useState("");
  if (error) return <p className="text-sm text-muted">The colors couldn&apos;t load. Refresh to try again.</p>;
  if (!data) return <p className="text-sm text-muted">Loading colors…</p>;

  const copy = async (s: Shade) => {
    if (await copyText(s.hex)) { setCopied(s.name); setTimeout(() => setCopied(null), 1500); }
  };
  const order = ["Green", "Neutral", "Periwinkle", "Teal", "Lime", "Yellow", "Orange", "Red"];
  const families = [...data].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  const term = q.trim().toLowerCase();
  const match = (f: { name: string }, s: Shade) => !term || [f.name, s.name, s.hex, s.rgb, s.cmyk, s.pms ?? ""].some((v) => v.toLowerCase().includes(term));
  const shownFamilies = families.map((f) => ({ ...f, shades: f.shades.filter((s) => match(f, s)) })).filter((f) => f.shades.length > 0);
  const total = shownFamilies.reduce((n, f) => n + f.shades.length, 0);

  const all = families.flatMap((f) => f.shades);
  const primary = ["Green 500", "Neutral 50", "Green 900"].map((n) => all.find((s) => s.name === n)).filter((s): s is Shade => !!s);

  const chip = (s: Shade) => {
    const i = s.name.lastIndexOf(" ");
    const [family, step] = i > 0 ? [s.name.slice(0, i), s.name.slice(i + 1)] : [s.name, ""];
    const ink = textOn(s.hex);
    const rule = <span aria-hidden="true" className="block h-px w-full bg-current opacity-30" />;
    return (
      <button key={s.name} onClick={() => copy(s)} aria-label={`Copy ${s.name}, ${s.hex}`} style={{ background: s.hex, color: ink }} className="card tile-hover group relative flex aspect-square flex-col justify-between overflow-hidden rounded-tight p-4 text-left">
        <span className="flex w-full flex-col gap-2 text-xs font-medium">
          <span>{s.hex}</span>{rule}
          <span>{s.rgb.replace(/, /g, " / ")}</span>{rule}
          <span>{s.cmyk.replace(/, /g, " / ")}</span>
          {s.pms && <>{rule}<span>PMS: {s.pms}</span></>}
        </span>
        <span className="block text-base font-bold leading-none">{family}<br />{step}</span>
        <span aria-hidden="true" className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${copied === s.name ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
          <span className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-round bg-n-1000 px-2 text-xs font-medium text-n-50 shadow-lg">
            <Icon name={copied === s.name ? "clipboardCheck" : "copy"} size={16} />{copied === s.name ? "Copied to clipboard!" : "Click to copy"}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted">Green 500 is the primary brand color. Use 100 to 300 for backgrounds, 500 to 700 for interaction and 800 to 900 for text on light surfaces. Click a swatch to copy its HEX.</p>
      <p role="status" className="sr-only">{copied ? `${copied} copied to clipboard` : ""}</p>
      <label className="relative block max-w-xl">
        <span className="sr-only">Search colors</span>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, HEX, RGB or PMS" className="block h-12 w-full rounded-tight border border-control bg-white pl-10 pr-4 text-sm" />
      </label>
      {term && <p className="text-sm text-muted" aria-live="polite">{total} {total === 1 ? "color" : "colors"} for “{q.trim()}”</p>}
      {!term && <section aria-labelledby="c-primary">
        <h2 id="c-primary" className="mb-4 text-lg font-bold">Primary colors</h2>
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] sm:max-w-3xl">{primary.map((s) => chip(s))}</div>
      </section>}
      {!term && (
        <section aria-labelledby="c-access" className="border-t border-line pt-8">
          <h2 id="c-access" className="text-xl font-bold">Accessible color combinations</h2>
          <p className="mb-4 mt-2 max-w-3xl text-sm text-muted">Pair text with these backgrounds. Body text needs a contrast ratio of at least 4.5:1 (AA). Large text, meaning 24 pixels or 19 pixels bold and up, and interface parts like icons and input borders need at least 3:1. Pairs marked &ldquo;Large text&rdquo; shouldn&apos;t be used for body copy, and colors that fail shouldn&apos;t carry meaning on their own.</p>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
            {COMBOS.map((c) => (
              <article key={c.name} aria-label={`Text colors on ${c.name}`} className="card flex flex-col gap-2 overflow-hidden rounded-tight p-4" style={{ background: c.bg }}>
                <h3 className="sr-only">{c.name} background</h3>
                {c.text.map(([label, fg]) => {
                  const r = ratio(fg, c.bg);
                  return (
                    <p key={`${label}${fg}`} className="flex items-baseline justify-between gap-2 text-base font-bold leading-snug" style={{ color: fg }}>
                      <span>{label}: {r.toFixed(2)}:1</span>
                      <span className="shrink-0 rounded-round border border-current px-2 text-xs font-medium">{grade(r)}</span>
                    </p>
                  );
                })}
                <p className="mt-auto pt-2 text-xs" style={{ color: textOn(c.bg) }}>{c.name} · {c.bg}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {!term && <h2 className="border-t border-line pt-8 text-xl font-bold">Full palette</h2>}
      {term && total === 0 && <p className="card p-6 text-sm text-muted">No colors match “{q.trim()}”. Try a family name like “green”, or a HEX like “#08794a”.</p>}
      {shownFamilies.map((f) => (
        <section key={f.name} aria-labelledby={`c-${f.name}`}>
          <h3 id={`c-${f.name}`} className="mb-4 text-lg font-bold">{f.name}</h3>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">{f.shades.map((s) => chip(s))}</div>
        </section>
      ))}
    </div>
  );
}
