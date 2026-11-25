"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { copyText } from "@/lib/brand/download";
import { useColors, type Shade } from "@/lib/brand/data";
import { textOn } from "@/lib/brand/contrast";
import { ContrastGuide } from "@/components/brand/ContrastGuide";

/** One color card. It reports the pointer to the page-level flag (see CopyFlag) and copies its HEX on click. */
function Swatch({ s, onCopy, onMove, onEnter, onLeave }: { s: Shade; onCopy: () => void; onMove: (x: number, y: number) => void; onEnter: () => void; onLeave: () => void }) {
  const i = s.name.lastIndexOf(" ");
  const [family, step] = i > 0 ? [s.name.slice(0, i), s.name.slice(i + 1)] : [s.name, ""];
  const rule = <span aria-hidden="true" className="block h-px w-full bg-current opacity-30" />;
  return (
    <button onClick={onCopy} onPointerEnter={onEnter} onPointerLeave={onLeave} onPointerMove={(e) => onMove(e.clientX, e.clientY)}
      onFocus={(e) => { if (!e.currentTarget.matches(":focus-visible")) return; const r = e.currentTarget.getBoundingClientRect(); onEnter(); onMove(r.left + 16, r.top + 16); }} onBlur={onLeave}
      aria-label={`Copy ${s.name}, ${s.hex}`} style={{ background: s.hex, color: textOn(s.hex) }} className="card tile-hover relative flex aspect-square flex-col justify-between overflow-hidden rounded-tight p-4 text-left">
      <span className="flex w-full flex-col gap-2 text-xs font-medium">
        <span>{s.hex}</span>{rule}
        <span>{s.rgb.replace(/, /g, " / ")}</span>{rule}
        <span>{s.cmyk.replace(/, /g, " / ")}</span>
        {s.pms && <>{rule}<span>PMS: {s.pms}</span></>}
      </span>
      <span className="block text-base font-bold leading-none">{family}<br />{step}</span>
    </button>
  );
}

/** The "Click to copy" flag. One of these floats freely at the lower right of the cursor (flipping at the window edges) while any color card is hovered, and its icon morphs from copy to clipboard-check once a color is copied. */
function CopyFlag({ flag, show, done }: { flag: React.RefObject<HTMLDivElement | null>; show: boolean; done: boolean }) {
  const morph = "absolute inset-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none";
  return (
    <div ref={flag} aria-hidden="true" style={{ transform: "translate(-200px, -200px)" }} className={`pointer-events-none fixed left-0 top-0 z-50 inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-round bg-n-1000 px-2 text-xs font-medium text-n-50 shadow-lg transition-opacity duration-150 ${show ? "opacity-100" : "opacity-0"}`}>
      <span className="relative block h-4 w-4">
        <span className={`${morph} ${done ? "scale-50 -rotate-12 opacity-0" : "scale-100 rotate-0 opacity-100"}`}><Icon name="copy" size={16} /></span>
        <span className={`${morph} ${done ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-12 opacity-0"}`}><Icon name="clipboardCheck" size={16} /></span>
      </span>
      {done ? "Copied to clipboard!" : "Click to copy"}
    </div>
  );
}

export function ColorsView() {
  const { data, error } = useColors();
  const [copied, setCopied] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [over, setOver] = useState(false);
  const flag = useRef<HTMLDivElement>(null);
  const at = useRef<{ x: number; y: number } | null>(null);
  const place = (x: number, y: number) => {
    at.current = { x, y };
    const f = flag.current;
    if (!f) return;
    // Lower right of the cursor; flip to the left or above when it would run off the window.
    const left = x + 16 + f.offsetWidth > window.innerWidth - 8 ? x - 16 - f.offsetWidth : x + 16;
    const top = y + 16 + f.offsetHeight > window.innerHeight - 8 ? y - 16 - f.offsetHeight : y + 16;
    f.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  };
  // The flag gets wider once it says "Copied to clipboard!", so place it again at the last pointer position.
  useEffect(() => { if (at.current) place(at.current.x, at.current.y); });
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

  const chip = (s: Shade) => <Swatch key={s.name} s={s} onCopy={() => copy(s)} onMove={place} onEnter={() => setOver(true)} onLeave={() => setOver(false)} />;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-8">
        <p role="status" className="sr-only">{copied ? `${copied} copied to clipboard` : ""}</p>
        <label className="relative block max-w-xl">
          <span className="sr-only">Search colors</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, HEX, RGB or PMS" className="block h-12 w-full rounded-tight border border-control bg-white pl-10 pr-4 text-sm" />
        </label>
        {term && <p className="text-sm text-muted" aria-live="polite">{total} {total === 1 ? "color" : "colors"} for “{q.trim()}”</p>}
        {!term && (
          <section aria-labelledby="c-primary">
            <h2 id="c-primary" className="mb-4 text-lg font-bold">Primary colors</h2>
            <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">{primary.map((s) => chip(s))}</div>
            <p className="mt-4 max-w-3xl text-sm text-muted">Green 500 is the primary brand color. Use 100 to 300 for backgrounds, 500 to 700 for interaction and 800 to 900 for text on light surfaces. Click a swatch to copy its HEX.</p>
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
      <ContrastGuide />
      <CopyFlag flag={flag} show={over || copied !== null} done={copied !== null} />
    </div>
  );
}
