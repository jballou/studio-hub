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

  const chip = (s: Shade, big = false) => (
    <button key={s.name} onClick={() => copy(s)} aria-label={`Copy ${s.name}, ${s.hex}`} className="card tile-hover group relative flex flex-col overflow-hidden rounded-tight text-left">
      <span className={`relative flex shrink-0 items-end p-2 text-xs font-bold ${big ? "h-28" : "h-20"}`} style={{ background: s.hex, color: textOn(s.hex) }}>
        {s.hex}
        <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-2 flex justify-center transition-opacity duration-150 ${copied === s.name ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
          <span className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-round bg-n-1000 px-2 text-xs font-medium text-n-50 shadow-lg">
            <Icon name={copied === s.name ? "clipboardCheck" : "copy"} size={16} />{copied === s.name ? "Copied to clipboard!" : "Click to copy"}
          </span>
        </span>
      </span>
      <span className="block p-2">
        <span className="block text-sm font-bold">{s.name}</span>
        <span className="mt-2 block text-xs text-muted">{s.rgb}</span>
        <span className="block text-xs text-muted">{s.cmyk}</span>
        {s.pms && <span className="block text-xs text-muted">PMS {s.pms}</span>}
      </span>
    </button>
  );

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
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:max-w-3xl">{primary.map((s) => chip(s, true))}</div>
      </section>}
      {!term && <h2 className="border-t border-line pt-8 text-xl font-bold">Full palette</h2>}
      {term && total === 0 && <p className="card p-6 text-sm text-muted">No colors match “{q.trim()}”. Try a family name like “green”, or a HEX like “#08794a”.</p>}
      {shownFamilies.map((f) => (
        <section key={f.name} aria-labelledby={`c-${f.name}`}>
          <h3 id={`c-${f.name}`} className="mb-4 text-lg font-bold">{f.name}</h3>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">{f.shades.map((s) => chip(s))}</div>
        </section>
      ))}
    </div>
  );
}
