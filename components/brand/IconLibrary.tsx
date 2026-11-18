"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { copyText, saveBlob, saveText, svgToPng } from "@/lib/brand/download";
import { iconSvg, useIcons, type BrandIcon } from "@/lib/brand/data";

const SIZES = [16, 24, 32, 48];
const COLORS = [
  { name: "Ink", hex: "#0F2E21" },
  { name: "Green", hex: "#089B5E" },
  { name: "Periwinkle", hex: "#5566BF" },
  { name: "Neutral", hex: "#5B5A57" },
  { name: "White", hex: "#FEFDFB" },
];

/** Groups by the first word of the name (arrow, chart, calendar...). Groups under three icons fold into Other. */
function categorise(icons: BrandIcon[]) {
  const first = (n: string) => n.split("-")[0];
  const counts = new Map<string, number>();
  icons.forEach((i) => counts.set(first(i.name), (counts.get(first(i.name)) ?? 0) + 1));
  const cat = (i: BrandIcon) => ((counts.get(first(i.name)) ?? 0) >= 3 ? first(i.name) : "other");
  return { cat, list: [...new Set(icons.map(cat))].sort((a, b) => (a === "other" ? 1 : b === "other" ? -1 : a.localeCompare(b))) };
}

const Glyph = ({ i, size, color }: { i: BrandIcon; size: number; color?: string }) => (
  <svg width={size} height={size} viewBox={i.vb} fill="none" aria-hidden="true" style={color ? { color } : undefined} dangerouslySetInnerHTML={{ __html: i.svg }} />
);

export function IconLibrary() {
  const { data: icons, error } = useIcons();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState(24);
  const [color, setColor] = useState(COLORS[0].hex);
  const [note, setNote] = useState<string | null>(null);

  const groups = useMemo(() => (icons ? categorise(icons) : null), [icons]);
  const shown = useMemo(() => {
    if (!icons || !groups) return [];
    const terms = q.toLowerCase().split(/[\s-]+/).filter(Boolean);
    return icons.filter((i) => (category === "all" || groups.cat(i) === category) && terms.every((t) => i.name.includes(t)));
  }, [icons, groups, q, category]);
  const current = icons?.find((i) => i.name === selected) ?? null;

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(null), 2000); };

  if (error) return <p className="text-sm text-muted">The icon library couldn&apos;t load. Refresh to try again.</p>;
  if (!icons || !groups) return <p className="text-sm text-muted">Loading icons…</p>;

  const dark = color === "#FEFDFB";
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <label className="relative block">
          <span className="sr-only">Search icons</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${icons.length} icons`} className="block h-10 w-full rounded-tight border border-control bg-white pl-10 pr-4 text-sm" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Category">
          {["all", ...groups.list].map((c) => (
            <button key={c} onClick={() => setCategory(c)} aria-pressed={category === c} className="chip">{c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}</button>
          ))}
        </div>
        <p className="mb-4 mt-4 text-sm text-muted" aria-live="polite">{shown.length} {shown.length === 1 ? "icon" : "icons"}</p>
        {shown.length === 0 ? (
          <p className="card p-6 text-sm text-muted">No icons match &ldquo;{q}&rdquo;. Try a shorter word, like &ldquo;chart&rdquo; or &ldquo;arrow&rdquo;.</p>
        ) : (
          <ul className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]">
            {shown.map((i) => (
              <li key={i.name}>
                <button onClick={() => setSelected(i.name)} aria-pressed={selected === i.name} title={i.name} className="card card-hover flex h-24 w-full flex-col items-center justify-center gap-2 p-2 aria-pressed:border-brand aria-pressed:bg-brand-soft">
                  <Glyph i={i} size={24} color="#0F2E21" />
                  <span className="w-full truncate text-center text-xs text-muted">{i.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside aria-label="Icon details" className="card w-full p-6 lg:sticky lg:top-6 lg:w-[22rem] lg:shrink-0">
        {!current ? (
          <p className="text-sm text-muted">Select an icon to preview it, change its size and color, and download it as SVG or PNG.</p>
        ) : (
          <>
            <div className={`flex h-40 items-center justify-center rounded-tight border border-line ${dark ? "bg-n-1000" : "bg-n-100"}`}>
              <Glyph i={current} size={Math.min(size * 2, 96)} color={color} />
            </div>
            <h2 className="mt-4 break-all text-lg font-bold">{current.name}</h2>

            <p className="mb-2 mt-4 text-xs font-bold text-muted">Size</p>
            <div className="flex gap-2" role="group" aria-label="Size">
              {SIZES.map((s) => <button key={s} onClick={() => setSize(s)} aria-pressed={size === s} className="chip">{s}</button>)}
            </div>
            <p className="mb-2 mt-4 text-xs font-bold text-muted">Color</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
              {COLORS.map((c) => (
                <button key={c.hex} onClick={() => setColor(c.hex)} aria-pressed={color === c.hex} title={`${c.name} ${c.hex}`} aria-label={`${c.name} ${c.hex}`}
                  className="h-8 w-8 rounded-round border border-control aria-pressed:ring-2 aria-pressed:ring-focus aria-pressed:ring-offset-2" style={{ background: c.hex }} />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button className="btn btn-md btn-primary" onClick={() => saveText(iconSvg(current, size, color), `${current.name}.svg`)}><Icon name="download" size={16} />SVG</button>
              <button className="btn btn-md btn-secondary" onClick={async () => {
                try { saveBlob(await svgToPng(iconSvg(current, size, color), size * 8), `${current.name}.png`); } catch { flash("Couldn't make the PNG."); }
              }}><Icon name="download" size={16} />PNG</button>
              <button className="btn btn-md btn-secondary" onClick={async () => flash((await copyText(iconSvg(current, size, color))) ? "SVG copied" : "Couldn't copy")}><Icon name="copy" size={16} />Copy SVG</button>
            </div>
            <p className="mt-2 text-xs text-muted" role="status">{note ?? `PNG downloads at ${size * 8}px wide.`}</p>
          </>
        )}
      </aside>
    </div>
  );
}
