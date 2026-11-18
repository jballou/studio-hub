"use client";

import { useState } from "react";
import { copyText } from "@/lib/brand/download";
import { useColors, type Shade } from "@/lib/brand/data";

// Text color that stays readable on a swatch.
const textOn = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? "#0F2E21" : "#FEFDFB";
};

export function ColorsView() {
  const { data, error } = useColors();
  const [copied, setCopied] = useState<string | null>(null);
  if (error) return <p className="text-sm text-muted">The colors couldn&apos;t load. Refresh to try again.</p>;
  if (!data) return <p className="text-sm text-muted">Loading colors…</p>;

  const copy = async (s: Shade) => {
    if (await copyText(s.hex)) { setCopied(s.name); setTimeout(() => setCopied(null), 1500); }
  };
  const order = ["Green", "Neutral", "Periwinkle", "Teal", "Lime", "Yellow", "Orange", "Red"];
  const families = [...data].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted">Green 500 is the primary brand color. Use 100 to 300 for backgrounds, 500 to 700 for interaction and 800 to 900 for text on light surfaces. Click a swatch to copy its HEX.</p>
      <p role="status" className="sr-only">{copied ? `${copied} copied` : ""}</p>
      {families.map((f) => (
        <section key={f.name} aria-labelledby={`c-${f.name}`}>
          <h2 id={`c-${f.name}`} className="mb-4 text-lg font-bold">{f.name}</h2>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
            {f.shades.map((s) => (
              <button key={s.name} onClick={() => copy(s)} aria-label={`Copy ${s.name}, ${s.hex}`} className="card card-hover overflow-hidden text-left">
                <span className="flex h-20 items-end p-2 text-xs font-bold" style={{ background: s.hex, color: textOn(s.hex) }}>{copied === s.name ? "Copied" : s.hex}</span>
                <span className="block p-2">
                  <span className="block text-sm font-bold">{s.name}</span>
                  <span className="mt-2 block text-xs text-muted">{s.rgb}</span>
                  <span className="block text-xs text-muted">{s.cmyk}</span>
                  {s.pms && <span className="block text-xs text-muted">PMS {s.pms}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
