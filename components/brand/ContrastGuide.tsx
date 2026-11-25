"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { COMBOS, QUICK_PICKS, grade, normalizeHex, ratio } from "@/lib/brand/contrast";

const RULES: { label: string; need: number }[] = [
  { label: "Body text, AA", need: 4.5 },
  { label: "Large text and interface parts, AA", need: 3 },
  { label: "Body text, AAA", need: 7 },
];

/** A color field: the brand picks, plus a HEX box for anything else. */
function Field({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const bad = draft !== null && !normalizeHex(draft);
  return (
    <div>
      <label htmlFor={`cg-${label}`} className="mb-2 block text-xs font-bold text-muted">{label}</label>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} picks`}>
        {QUICK_PICKS.map((c) => (
          <button key={c.hex} type="button" onClick={() => { setDraft(null); onChange(c.hex); }} aria-pressed={value === c.hex} title={`${c.name} ${c.hex}`} aria-label={`${c.name} ${c.hex}`}
            className="h-8 w-8 rounded-round border border-control aria-pressed:ring-2 aria-pressed:ring-focus aria-pressed:ring-offset-2" style={{ background: c.hex }} />
        ))}
      </div>
      <input id={`cg-${label}`} value={shown} onChange={(e) => { setDraft(e.target.value); const h = normalizeHex(e.target.value); if (h) onChange(h); }} onBlur={() => setDraft(null)}
        aria-invalid={bad} aria-describedby={bad ? `cg-${label}-err` : undefined} maxLength={7} spellCheck={false} placeholder="#0F2E21" className="mt-2 block h-10 w-full rounded-tight border border-control bg-white px-4 font-mono text-sm uppercase" />
      {bad && <p id={`cg-${label}-err`} className="mt-2 text-xs text-bad-fg">Use a HEX like #0F2E21.</p>}
    </div>
  );
}

/** Guidance on pairing colors, with a live contrast checker (WCAG 2 contrast ratio, the same maths behind the palette). */
export function ContrastGuide() {
  const [fg, setFg] = useState("#0F2E21");
  const [bg, setBg] = useState("#FEFDFB");
  const r = ratio(fg, bg);
  const combo = COMBOS.find((c) => c.bg === bg);

  return (
    <aside aria-label="Accessibility" className="card w-full p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto">
      <h2 className="text-lg font-bold">Accessibility</h2>
      <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-muted">
        <li>Body text needs a contrast ratio of at least 4.5:1.</li>
        <li>Large text (24px, or 19px bold, and up) and interface parts like icons and input borders need 3:1.</li>
        <li>Don&apos;t use color alone to carry meaning.</li>
      </ul>

      <div className="mt-4 rounded-tight border border-line p-4" style={{ background: bg, color: fg }}>
        <p className="text-2xl font-bold leading-tight">Large text sample</p>
        <p className="mt-2 text-sm">Body text sample. The quick brown monkey jumps over the lazy dog.</p>
      </div>

      <p className="mt-4 text-3xl font-bold" aria-live="polite">{r.toFixed(2)}:1 <span className="text-sm font-medium text-muted">{grade(r)}</span></p>
      <ul className="mt-2 space-y-2">
        {RULES.map((rule) => {
          const ok = r >= rule.need;
          return (
            <li key={rule.label} className="flex items-center gap-2 text-sm">
              <span className={ok ? "text-brand" : "text-bad-fg"}><Icon name={ok ? "check" : "x"} size={16} /></span>
              <span>{rule.label}</span>
              <span className="ml-auto text-xs font-medium text-muted">{ok ? "Pass" : "Fail"} · {rule.need}:1</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 space-y-4">
        <Field label="Text color" value={fg} onChange={setFg} />
        <Field label="Background" value={bg} onChange={setBg} />
        <button type="button" onClick={() => { setFg(bg); setBg(fg); }} className="btn btn-sm btn-secondary"><Icon name="refresh" size={14} />Swap colors</button>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-bold text-muted">Recommended on this background</h3>
      {combo ? (
        <ul className="space-y-2">
          {combo.text.map(([label, hex]) => {
            const rr = ratio(hex, bg);
            return (
              <li key={`${label}${hex}`}>
                <button type="button" onClick={() => setFg(hex)} aria-pressed={fg === hex} className="flex w-full items-center gap-2 rounded-tight border border-line px-2 py-2 text-left text-sm hover:bg-n-150 aria-pressed:border-brand">
                  <span className="h-4 w-4 shrink-0 rounded-round border border-control" style={{ background: hex }} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="shrink-0 text-xs text-muted">{rr.toFixed(2)}:1 · {grade(rr)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Pick a brand background, like Neutral 50 or Green 900, to see which text colors we recommend on it.</p>
      )}
    </aside>
  );
}
