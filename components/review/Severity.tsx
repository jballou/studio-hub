"use client";

import { Tag, type Tone } from "@/components/ui/Tag";
import { SEVERITY_HINT, SEVERITY_LABEL, type Severity } from "@/lib/types";

const LEVELS: Severity[] = [0, 1, 2, 3, 4];
const TONE: Record<Severity, Tone> = { 0: "bad", 1: "warn", 2: "gold", 3: "info", 4: "neutral" };

export function SeverityBadge({ level }: { level: Severity }) {
  return <Tag tone={TONE[level]} title={`${SEVERITY_LABEL[level]}: ${SEVERITY_HINT[level]}`}>{level} · {SEVERITY_LABEL[level]}</Tag>;
}

/** 0 (critical) to 4 (cosmetic). Optional: pick the same level again to clear it. */
export function SeverityPicker({ value, onChange }: { value: Severity | undefined; onChange: (v: Severity | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label="Severity" className="flex items-center gap-2">
      <span className="text-muted">Severity</span>
      <div className="flex gap-2">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === l}
            aria-label={`${l}, ${SEVERITY_LABEL[l]}: ${SEVERITY_HINT[l]}`}
            title={`${l} · ${SEVERITY_LABEL[l]}: ${SEVERITY_HINT[l]}`}
            onClick={() => onChange(value === l ? undefined : l)}
            className={`h-7 w-7 rounded-lg border text-xs font-semibold tabular-nums ${value === l ? "border-brand bg-brand text-n-50" : "border-control bg-white hover:bg-brand-soft"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {value !== undefined && <span className="text-muted">{SEVERITY_LABEL[value]}</span>}
    </div>
  );
}
