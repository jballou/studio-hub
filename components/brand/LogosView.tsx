"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { saveBlob } from "@/lib/brand/download";
import { svgToPng } from "@/lib/brand/download";
import { useLogos, type Logo } from "@/lib/brand/data";

const BRANDS: Record<string, string> = { surveymonkey: "SurveyMonkey", launchpad: "LaunchPad", getfeedback: "GetFeedback" };
const KINDS: Record<string, string> = { primary: "Primary", secondary: "Secondary", logomark: "Logomark", mark: "Mark", logo: "Logo", symbol: "Symbol", avatar: "Social avatar", favicon: "Browser favicon", appicon: "App icon" };
// Square and round marks for social profiles, browser tabs and app stores. They get their own sections below the logos.
const SMALL: Record<string, { title: string; note: string; size: number; png: number }> = {
  avatar: { title: "Social avatars", note: "Profile pictures for social channels. Use the square or soft square where the platform crops to a circle itself, and the round one where it doesn't.", size: 96, png: 1024 },
  favicon: { title: "Browser favicons", note: "The tab icon for the web. It has to stay legible at 16 pixels, so don't substitute the full logo.", size: 32, png: 512 },
  appicon: { title: "App icons", note: "For app stores and home screens.", size: 96, png: 1024 },
};
// Light-on-dark variants need a dark tile to be visible.
const onDark = (l: Logo) => /white|light/.test(l.variant) && !/dark/.test(l.variant);

export function LogosView() {
  const { data, error } = useLogos();
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <p className="text-sm text-muted">The logos couldn&apos;t load. Refresh to try again.</p>;
  if (!data) return <p className="text-sm text-muted">Loading logos…</p>;

  const png = async (l: Logo) => {
    const px = SMALL[l.kind]?.png ?? 2000;
    setBusy(l.id);
    try {
      const svg = await (await fetch(l.path)).text();
      saveBlob(await svgToPng(svg, px), `${l.brand}-${l.kind}-${l.variant}.png`);
    } catch { /* leave the button usable */ }
    setBusy(null);
  };

  const actions = (l: Logo) => (
    <div className="flex shrink-0 gap-2">
      <a href={l.path} download={`${l.brand}-${l.kind}-${l.variant}.svg`} className="btn btn-sm btn-secondary"><Icon name="download" size={14} />SVG</a>
      <button onClick={() => png(l)} disabled={busy === l.id} className="btn btn-sm btn-secondary">{busy === l.id ? "…" : "PNG"}</button>
    </div>
  );

  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted">Use the logo that has the most contrast with its background, and leave clear space around it equal to the height of the monkey&apos;s head. Don&apos;t recolor, stretch or add effects.</p>
      {Object.keys(BRANDS).map((brand) => {
        const logos = data.filter((l) => l.brand === brand && !SMALL[l.kind]);
        if (!logos.length) return null;
        return (
          <section key={brand} aria-labelledby={`b-${brand}`}>
            <h2 id={`b-${brand}`} className="mb-4 text-lg font-bold">{BRANDS[brand]}</h2>
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
              {logos.map((l) => (
                <article key={l.id} className="card overflow-hidden">
                  <div className={`flex h-40 items-center justify-center p-6 ${onDark(l) ? "bg-n-1000" : "bg-n-50"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.path} alt={`${BRANDS[brand]} ${KINDS[l.kind] ?? l.kind} logo, ${l.variant}`} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{KINDS[l.kind] ?? l.kind}</p>
                      <p className="truncate text-xs capitalize text-muted">{l.variant.replace("-", " ")}</p>
                    </div>
                    {actions(l)}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {Object.entries(SMALL).map(([kind, meta]) => {
        const items = data.filter((l) => l.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} aria-labelledby={`s-${kind}`} className="border-t border-line pt-8">
            <h2 id={`s-${kind}`} className="text-lg font-bold">{meta.title}</h2>
            <p className="mb-4 mt-2 max-w-3xl text-sm text-muted">{meta.note}</p>
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
              {items.map((l) => (
                <article key={l.id} className="card overflow-hidden">
                  <div className="flex h-40 items-center justify-center bg-n-50 p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.path} width={meta.size} height={meta.size} alt={`${BRANDS[l.brand]} ${(KINDS[kind] ?? kind).toLowerCase()}, ${l.variant.replace("-", " ")}`} style={{ width: meta.size, height: meta.size }} />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{BRANDS[l.brand]}</p>
                      <p className="truncate text-xs capitalize text-muted">{l.variant.replace("-", " ")}</p>
                    </div>
                    {actions(l)}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
