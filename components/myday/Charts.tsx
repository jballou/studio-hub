"use client";

import type { Timeline } from "@/lib/myday/plan";

type Slice = { key: string; label: string; color: string; count: number };

/** Donut of counts by status. The legend carries every number, so color is never the only cue. */
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const total = slices.reduce((n, s) => n + s.count, 0);
  const R = 52, C = 2 * Math.PI * R, GAP = total > 1 ? 2.5 : 0;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={`${total} items. ${slices.map((s) => `${s.label}: ${s.count}`).join(". ")}`} className="shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-n-150)" strokeWidth="16" />
        {total > 0 && slices.filter((s) => s.count > 0).map((s) => {
          const len = (s.count / total) * C;
          const seg = (
            <circle key={s.key} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)">
              <title>{`${s.label}: ${s.count}`}</title>
            </circle>
          );
          offset += len;
          return seg;
        })}
        <text x="70" y="68" textAnchor="middle" className="fill-ink text-[26px] font-bold">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="fill-muted text-[10px]">{centerLabel}</text>
      </svg>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.key} className={`flex items-center gap-2 ${s.count === 0 ? "opacity-50" : ""}`}>
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="flex-1">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BAR = { ok: "#08794a", watch: "#a95c18", late: "#8a3734", none: "#908d89" } as const;
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Time used between submission and deadline. Fills red once the deadline has passed. */
export function TimelineMeter({ t, label }: { t: Timeline; label: string }) {
  if (t.state === "none") return <p className="text-xs text-muted">No deadline set</p>;
  const left = t.daysLeft!;
  const words = left < 0 ? `${-left} day${left === -1 ? "" : "s"} late` : left === 0 ? "Due today" : `${left} day${left === 1 ? "" : "s"} left`;
  return (
    <div>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.pct} aria-valuetext={`${t.pct}% of the time used, ${words}`} className="h-2 overflow-hidden rounded-full bg-n-150">
        <div className="h-full rounded-full" style={{ width: `${Math.max(t.pct, 3)}%`, background: BAR[t.state] }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs text-muted">
        <span>{day(t.from)}</span>
        <span className={t.state === "late" ? "font-semibold text-bad-fg" : t.state === "watch" ? "font-semibold text-warn-fg" : ""}>{words} · due {day(t.to)}</span>
      </div>
    </div>
  );
}

/** Big percentage with a bar. Bar color follows the score band; the number stays in ink. */
export function ScoreMeter({ score }: { score: number | null }) {
  if (score === null) return <p className="text-sm text-muted">Add a deadline to a task to start your score.</p>;
  const color = score >= 80 ? "#08794a" : score >= 50 ? "#a95c18" : "#8a3734";
  return (
    <div>
      <div className="flex items-baseline gap-1"><span className="text-5xl font-bold tabular-nums">{score}</span><span className="text-xl font-semibold text-muted">%</span></div>
      <div role="meter" aria-label="On-time score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="mt-2 h-2.5 overflow-hidden rounded-full bg-n-150">
        <div className="h-full rounded-full" style={{ width: `${Math.max(score, 2)}%`, background: color }} />
      </div>
    </div>
  );
}
