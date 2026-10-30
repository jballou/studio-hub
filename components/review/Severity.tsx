"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Tag, type Tone } from "@/components/ui/Tag";
import { SEVERITY_HINT, SEVERITY_LABEL, type Severity } from "@/lib/types";

const LEVELS: Severity[] = [0, 1, 2, 3, 4];
/** Red !!, orange !, yellow flag, green flag, and a quiet speech bubble for a casual observation. */
const LOOK: Record<Severity, { tone: Tone; icon: IconName; on: string; off: string }> = {
  0: { tone: "bad", icon: "bangs", on: "border-bad-fg bg-bad-bg text-bad-fg", off: "text-bad-fg" },
  1: { tone: "warn", icon: "bang", on: "border-warn-fg bg-warn-bg text-warn-fg", off: "text-warn-fg" },
  2: { tone: "gold", icon: "flag", on: "border-gold-fg bg-gold-bg text-gold-fg", off: "text-gold-fg" },
  3: { tone: "ok", icon: "flag", on: "border-ok-fg bg-ok-bg text-ok-fg", off: "text-ok-fg" },
  4: { tone: "neutral", icon: "comment", on: "border-n-800 bg-n-150 text-n-800", off: "text-n-650" },
};

export function SeverityBadge({ level }: { level: Severity }) {
  return <Tag tone={LOOK[level].tone} icon={LOOK[level].icon} title={`${level} · ${SEVERITY_LABEL[level]}: ${SEVERITY_HINT[level]}`}>{SEVERITY_LABEL[level]}</Tag>;
}

/** 0 (critical) to 4 (cosmetic), shown as icons. Optional: pick the same level again to clear it. */
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
            className={`flex h-8 w-8 items-center justify-center rounded-tight border ${value === l ? `border-2 ${LOOK[l].on}` : `border-control bg-white hover:bg-n-150 ${LOOK[l].off}`}`}
          >
            <Icon name={LOOK[l].icon} size={16} />
          </button>
        ))}
      </div>
      {value !== undefined && <span className="text-muted">{SEVERITY_LABEL[value]}</span>}
    </div>
  );
}
