"use client";

import { TYPE_SCALE } from "@/lib/brand/data";
import { FontDownload } from "./FontDownload";

const WEIGHTS = [{ name: "Regular", w: 400 }, { name: "Medium", w: 500 }, { name: "Bold", w: 700 }];

export function TypeView() {
  return (
    <div className="space-y-8">
      <section className="card p-6" aria-labelledby="family">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="family" className="text-lg font-bold">National 2</h2>
          <FontDownload />
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted">The one brand typeface, in Regular, Medium and Bold. National 2 is a licensed font. Use the installed font in design files, and never substitute another face for brand work.</p>
        <p className="mt-6 font-bold" style={{ fontSize: 92, lineHeight: "92px" }}>Aa</p>
        <div className="mt-6 flex flex-wrap gap-6">
          {WEIGHTS.map((w) => (
            <p key={w.name} className="text-2xl" style={{ fontWeight: w.w }}>{w.name}</p>
          ))}
        </div>
        <p className="mt-6 text-xl [overflow-wrap:anywhere]">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 !?&amp;@#%</p>
      </section>

      <section aria-labelledby="scale">
        <h2 id="scale" className="mb-4 text-lg font-bold">Type scale</h2>
        <div className="card divide-y divide-line">
          {TYPE_SCALE.map((t) => (
            <div key={t.name} className="flex flex-col gap-2 p-6">
              <div>
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-xs text-muted">{t.size}px / {t.line}px · {t.weight === 400 ? "Regular" : t.weight === 500 ? "Medium" : "Bold"}</p>
              </div>
              <p className="min-w-0 truncate" style={{ fontSize: t.size, lineHeight: `${t.line}px`, fontWeight: t.weight, paddingBottom: Math.round(t.size * 0.25) }}>{t.sample}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
