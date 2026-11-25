"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { copyText, saveBlob, saveText, svgToPng } from "@/lib/brand/download";
import { detailedSvg, paintDetailed, useDetailedIcons, type DetailedIcon } from "@/lib/brand/data";

const SIZES = [64, 128, 256];
const MID = "#82807D";
// The larger icons are drawn with a line color, a fixed gray, and one accent. These are the brand's accent roles.
const LINES = [
  { name: "Ink", hex: "#464543" },
  { name: "Green 900", hex: "#0F2E21" },
  { name: "Black", hex: "#000000" },
  { name: "Neutral 50", hex: "#FEFDFB" },
];
const ACCENTS = [
  { name: "Primary", hex: "#08794A" },
  { name: "Primary (light)", hex: "#B0E8C3" },
  { name: "Primary (on dark)", hex: "#39C67F" },
  { name: "Success", hex: "#B6CD40" },
  { name: "Warning", hex: "#CEA40D" },
  { name: "Error", hex: "#AE453F" },
  { name: "Info", hex: "#64BCC4" },
  { name: "Upgrade", hex: "#E2BF36" },
];

const Glyph = ({ i, size, line, accent }: { i: DetailedIcon; size: number; line: string; accent: string }) => (
  <svg width={size} height={size} viewBox={i.vb} fill="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paintDetailed(i.svg, { line, mid: MID, accent }) }} />
);

/** The larger, two-color icons. The grid shows them in the default colors; the panel recolors the one you pick. */
export function DetailedIconLibrary() {
  const { data: icons, error } = useDetailedIcons();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState(128);
  // null means "the default": ink and the icon's own accent on light, light line and light green on dark.
  const [lineChoice, setLine] = useState<string | null>(null);
  const [accentChoice, setAccent] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const shown = useMemo(() => {
    if (!icons) return [];
    const terms = q.toLowerCase().split(/[\s-]+/).filter(Boolean);
    return icons.filter((i) => terms.every((t) => i.name.includes(t)));
  }, [icons, q]);
  const current = icons?.find((i) => i.name === selected) ?? null;
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(null), 2000); };
  const line = lineChoice ?? (dark ? "#FEFDFB" : "#464543");
  const accent = accentChoice ?? current?.a ?? (dark ? "#39C67F" : "#08794A");
  const colors = { line, mid: MID, accent };
  // On dark the line has to flip to light, and the primary accent to its light green, so switching resets both.
  const setMode = (d: boolean) => { setDark(d); setLine(null); setAccent(null); };

  if (error) return <p className="text-sm text-muted">The detailed icons couldn&apos;t load. Refresh to try again.</p>;
  if (!icons) return <p className="text-sm text-muted">Loading icons…</p>;

  const pick = (label: string, list: { name: string; hex: string }[], value: string, set: (h: string) => void) => (
    <>
      <p className="mb-2 mt-4 text-xs font-bold text-muted">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {list.map((c) => (
          <button key={c.hex} onClick={() => set(c.hex)} aria-pressed={value === c.hex} title={`${c.name} ${c.hex}`} aria-label={`${c.name} ${c.hex}`}
            className="h-8 w-8 rounded-round border border-control aria-pressed:ring-2 aria-pressed:ring-focus aria-pressed:ring-offset-2" style={{ background: c.hex }} />
        ))}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <label className="relative block">
          <span className="sr-only">Search detailed icons</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${icons.length} detailed icons`} className="block h-12 w-full rounded-tight border border-control bg-white pl-10 pr-4 text-sm" />
        </label>
        <p className="mb-4 mt-4 text-sm text-muted" aria-live="polite">{shown.length} {shown.length === 1 ? "icon" : "icons"}</p>
        {shown.length === 0 ? (
          <p className="card p-6 text-sm text-muted">No icons match &ldquo;{q}&rdquo;. Try a shorter word, like &ldquo;survey&rdquo; or &ldquo;data&rdquo;.</p>
        ) : (
          <ul className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
            {shown.map((i) => (
              <li key={i.name}>
                <button onClick={() => setSelected(i.name)} aria-pressed={selected === i.name} title={i.name} className="card tile-hover rounded-tight flex h-40 w-full flex-col items-center justify-center gap-4 p-2 aria-pressed:border-brand aria-pressed:bg-brand-soft">
                  <Glyph i={i} size={64} line="#464543" accent={i.a ?? "#08794A"} />
                  <span className="w-full truncate text-center text-xs text-muted">{i.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside aria-label="Icon details" className="card w-full p-6 lg:sticky lg:top-6 lg:w-[22rem] lg:shrink-0">
        {!current ? (
          <p className="text-sm text-muted">Select an icon to preview it, choose its line and accent colors, and download it as SVG or PNG.</p>
        ) : (
          <>
            <div className={`flex h-48 items-center justify-center rounded-tight border border-line ${dark ? "bg-n-1000" : "bg-n-100"}`}>
              <Glyph i={current} size={Math.min(size, 128)} line={line} accent={accent} />
            </div>
            <h2 className="mt-4 break-all text-lg font-bold">{current.name}</h2>

            <p className="mb-2 mt-4 text-xs font-bold text-muted">Background</p>
            <div className="flex gap-2" role="group" aria-label="Background">
              <button onClick={() => setMode(false)} aria-pressed={!dark} className="chip">On light</button>
              <button onClick={() => setMode(true)} aria-pressed={dark} className="chip">On dark</button>
            </div>
            {pick("Line color", LINES, line, setLine)}
            {pick("Accent color", ACCENTS, accent, setAccent)}
            <p className="mb-2 mt-4 text-xs font-bold text-muted">Size</p>
            <div className="flex gap-2" role="group" aria-label="Size">
              {SIZES.map((s) => <button key={s} onClick={() => setSize(s)} aria-pressed={size === s} className="chip">{s}</button>)}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button className="btn btn-md btn-primary" onClick={() => saveText(detailedSvg(current, size, colors), `${current.name}.svg`)}><Icon name="download" size={16} />SVG</button>
              <button className="btn btn-md btn-secondary" onClick={async () => {
                try { saveBlob(await svgToPng(detailedSvg(current, size, colors), size * 4), `${current.name}.png`); } catch { flash("Couldn't make the PNG."); }
              }}><Icon name="download" size={16} />PNG</button>
              <button className="btn btn-md btn-secondary" onClick={async () => flash((await copyText(detailedSvg(current, size, colors))) ? "SVG copied" : "Couldn't copy")}><Icon name="copy" size={16} />Copy SVG</button>
            </div>
            <p className="mt-2 text-xs text-muted" role="status">{note ?? `PNG downloads at ${size * 4}px wide.`}</p>
          </>
        )}
      </aside>
    </div>
  );
}
