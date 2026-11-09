"use client";

import type { Kr } from "@/lib/okr/types";

export const NO_KR = "none";

/** "Which goal does this support?" One native select, KRs grouped by objective, plus an honest "none" so nobody guesses. */
export function KrPicker({ krs, value, onChange, optional = false, sample = false, id = "kr-picker" }: { krs: Kr[]; value: string; onChange: (v: string) => void; optional?: boolean; sample?: boolean; id?: string }) {
  const groups = [...new Set(krs.map((k) => k.objective || "Other"))];
  return (
    <label htmlFor={id} className="block text-sm font-bold">Which goal does this support?{optional && <span className="font-normal text-muted"> (optional)</span>}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal">
        <option value="">{optional ? "Not sure yet" : "Choose one…"}</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {krs.filter((k) => (k.objective || "Other") === g).map((k) => <option key={k.id} value={k.id}>{k.kr}</option>)}
          </optgroup>
        ))}
        <option value={NO_KR}>Not tied to a KR (business as usual)</option>
      </select>
      <span className="mt-2 block text-xs font-normal text-muted">{sample ? "These are sample goals, not the real OKRs. Tags made now may need redoing after the real sync." : "Reports use this to show how creative work lines up with company goals."}</span>
    </label>
  );
}
