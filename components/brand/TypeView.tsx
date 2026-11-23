"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { PAIRINGS, SENTENCE, TYPE_SCALE, isShortStyle } from "@/lib/brand/scale";
import { FontDownload } from "./FontDownload";

const WEIGHTS = [{ name: "Regular", w: 400 }, { name: "Medium", w: 500 }, { name: "Bold", w: 700 }];
const weightName = (w: number) => (w === 400 ? "Regular" : w === 500 ? "Medium" : "Bold");
const PREVIEW_KEY = "type-preview-v1";
type Style = (typeof TYPE_SCALE)[number];
const BY_NAME = new Map(TYPE_SCALE.map((t) => [t.name, t]));
const specs = (t: Style) => `${t.size}px / ${t.line}px · ${weightName(t.weight)}`;

export function TypeView() {
  const [preview, setPreview] = useState("");
  const [sel, setSel] = useState<Style | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setPreview(localStorage.getItem(PREVIEW_KEY) ?? ""); } catch { /* storage unavailable */ }
  }, []);
  const edit = (v: string) => { setPreview(v); try { if (v) localStorage.setItem(PREVIEW_KEY, v); else localStorage.removeItem(PREVIEW_KEY); } catch { /* ignore */ } };
  const text = preview.trim() || SENTENCE;
  const sampleOf = (t: Style) => (isShortStyle(t.name) ? t.sample : text);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (sel && !d.open) d.showModal();
    if (!sel && d.open) d.close();
  }, [sel]);

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
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <label className="block min-w-0 max-w-2xl flex-1 text-sm font-bold">Preview text
            <input value={preview} onChange={(e) => edit(e.target.value)} maxLength={200} placeholder={SENTENCE} className="mt-2 block h-10 w-full rounded-tight border border-control bg-white px-4 text-sm font-normal" />
          </label>
          {preview && <button onClick={() => edit("")} className="btn btn-md btn-secondary">Reset</button>}
        </div>
        <p className="mb-4 text-xs text-muted">Type your own text to see every style with it. Labels and eyebrows keep their short text. Select a style to see what it&apos;s for and what it pairs with.</p>
        <ul className="card divide-y divide-line overflow-hidden">
          {TYPE_SCALE.map((t) => (
            <li key={t.name}>
              <button onClick={() => setSel(t)} aria-haspopup="dialog" className="flex w-full flex-col gap-2 p-6 text-left hover:bg-n-100 focus-visible:bg-n-100">
                <span className="flex w-full items-center justify-between gap-4">
                  <span>
                    <span className="block text-sm font-bold">{t.name}</span>
                    <span className="block text-xs text-muted">{specs(t)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs font-medium text-brand">Pairings <Icon name="chevronRight" size={14} /></span>
                </span>
                <span className="block min-w-0 max-w-full truncate" style={{ fontSize: t.size, lineHeight: `${t.line}px`, fontWeight: t.weight, paddingBottom: Math.round(t.size * 0.25) }}>{sampleOf(t)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <dialog ref={dlg} aria-labelledby="style-h" onClose={() => setSel(null)} onClick={(e) => { if (e.target === dlg.current) setSel(null); }}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-loose border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/40">
        {sel && <StyleDetail t={sel} text={text} onPick={(n) => { const s = BY_NAME.get(n); if (s) setSel(s); }} onClose={() => setSel(null)} />}
      </dialog>
    </div>
  );
}

/** One style: what it's for, the styles it sits with, and a small page built from them so the sizes make sense together. */
function StyleDetail({ t, text, onPick, onClose }: { t: Style; text: string; onPick: (name: string) => void; onClose: () => void }) {
  const pair = PAIRINGS[t.name];
  const isEyebrow = t.name.startsWith("Label Eyebrow");
  const isLabel = t.name.startsWith("Label") && !isEyebrow;
  const isBody = t.name.startsWith("Body");
  const get = (n?: string) => (n ? BY_NAME.get(n) : undefined);
  const parts = useMemo(() => {
    const eyebrow = isEyebrow ? t : get(pair.eyebrow);
    const label = isLabel ? t : get(pair.label);
    const body = isBody ? t : get(pair.body);
    const heading = isEyebrow || isLabel || isBody ? get(pair.heading) : t;
    return { eyebrow, heading, body, label };
  }, [t, pair, isEyebrow, isLabel, isBody]);

  const shown = [parts.eyebrow, parts.heading, parts.body, parts.label].filter((x): x is Style => !!x);
  const scale = Math.min(1, 56 / Math.max(...shown.map((s) => s.size)));
  const px = (n: number) => Math.max(10, Math.round(n * scale));
  const styleOf = (s: Style) => ({ fontSize: px(s.size), lineHeight: `${Math.max(px(s.line), px(s.size) + 2)}px`, fontWeight: s.weight });
  const others = [...new Set([pair.eyebrow, pair.heading, pair.body, pair.label])].filter((n): n is string => !!n && n !== t.name);

  return (
    <div className="flex max-h-[min(90dvh,48rem)] flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-line p-6">
        <div>
          <h2 id="style-h" className="text-xl font-bold">{t.name}</h2>
          <p className="mt-2 text-sm text-muted">{specs(t)}</p>
        </div>
        <button onClick={onClose} className="btn btn-md btn-secondary" autoFocus>Close</button>
      </header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        <section aria-labelledby="use-h">
          <h3 id="use-h" className="text-sm font-bold">Use it for</h3>
          <p className="mt-2 text-sm text-n-800">{pair.use}</p>
        </section>

        <section aria-labelledby="pair-h">
          <h3 id="pair-h" className="text-sm font-bold">Pairs with</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {others.map((n) => {
              const s = BY_NAME.get(n)!;
              return <li key={n}><button onClick={() => onPick(n)} className="chip" title={specs(s)}>{n}<span className="text-xs text-muted">{s.size}/{s.line}</span></button></li>;
            })}
          </ul>
        </section>

        <section aria-labelledby="ctx-h">
          <h3 id="ctx-h" className="text-sm font-bold">In context</h3>
          <div className="mt-2 overflow-hidden rounded-tight border border-line bg-n-100 p-6">
            {parts.eyebrow && <p className="mb-2 text-brand" style={styleOf(parts.eyebrow)}>Eyebrow label</p>}
            {parts.heading && <p className="[overflow-wrap:anywhere]" style={styleOf(parts.heading)}>{parts.heading === t ? text : "Ask better questions"}</p>}
            {parts.body && <p className="mt-2 max-w-prose text-n-800 [overflow-wrap:anywhere]" style={styleOf(parts.body)}>{parts.body === t ? text : "Great decisions start with great questions."}</p>}
            {parts.label && <span className="mt-4 inline-flex items-center rounded-tight bg-brand px-4 py-2 text-n-50" style={styleOf(parts.label)}>Button label</span>}
          </div>
          <p className="mt-2 text-xs text-muted">{scale < 1 ? `Shown at ${Math.round(scale * 100)}% so it fits, with the sizes kept in proportion.` : "Shown at full size."} The selected style uses your preview text.</p>
        </section>
      </div>
    </div>
  );
}
