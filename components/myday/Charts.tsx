"use client";

import Link from "next/link";
import type { GanttBar, Timeline } from "@/lib/myday/plan";

type Part = { key: string; label: string; color: string; count: number };

const CX = 100, CY = 100, RO = 92, RI = 62, INSET = 3, GAP_DEG = 3;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Point on the half circle, `deg` from the left end (0) to the right end (180). */
const pt = (r: number, deg: number) => `${(CX - r * Math.cos(rad(deg))).toFixed(2)},${(CY - r * Math.sin(rad(deg))).toFixed(2)}`;

/** One ring segment. It is drawn a few pixels smaller and stroked in its own color with round joins, which rounds the corners. */
function arc(from: number, to: number): string {
  const ro = RO - INSET, ri = RI + INSET;
  const a0 = from + (INSET / ro) * (180 / Math.PI), a1 = to - (INSET / ro) * (180 / Math.PI);
  const b0 = from + (INSET / ri) * (180 / Math.PI), b1 = to - (INSET / ri) * (180 / Math.PI);
  if (a1 <= a0 || b1 <= b0) return "";
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${pt(ro, a0)} A ${ro} ${ro} 0 ${large} 1 ${pt(ro, a1)} L ${pt(ri, b1)} A ${ri} ${ri} 0 ${large} 0 ${pt(ri, b0)} Z`;
}

/** Half-circle gauge: share finished, with the three parts in the legend so color is never the only cue. */
export function Gauge({ parts, pct, caption }: { parts: Part[]; pct: number; caption: string }) {
  const shown = parts.filter((s) => s.count > 0);
  const total = shown.reduce((n, s) => n + s.count, 0);
  const free = 180 - GAP_DEG * Math.max(shown.length - 1, 0);
  return (
    <div>
      <svg viewBox="0 0 200 112" role="img" aria-label={`${pct}% complete. ${parts.map((s) => `${s.label}: ${s.count}`).join(". ")}`} className="mx-auto block w-full max-w-[18rem] overflow-visible">
        {total === 0 && <path d={arc(0, 180)} fill="var(--color-n-150)" stroke="var(--color-n-150)" strokeWidth={INSET * 2} strokeLinejoin="round" />}
        {shown.map((s, i) => {
          const before = shown.slice(0, i).reduce((n, x) => n + (x.count / total) * free + GAP_DEG, 0);
          return (
            <path key={s.key} d={arc(before, before + (s.count / total) * free)} fill={s.color} stroke={s.color} strokeWidth={INSET * 2} strokeLinejoin="round" className="transition-opacity hover:opacity-80">
              <title>{`${s.label}: ${s.count}`}</title>
            </path>
          );
        })}
        <text x={CX} y={CY - 6} textAnchor="middle" className="fill-ink text-4xl font-bold tabular-nums">{pct}<tspan className="fill-muted text-xl font-semibold">%</tspan></text>
      </svg>
      <p className="mt-2 text-center text-sm text-muted">{caption}</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
        {parts.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label} <b className="tabular-nums">{s.count}</b>
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
      <div className="mt-2 flex justify-between gap-2 text-xs text-muted">
        <span>{day(t.from)}</span>
        <span className={t.state === "late" ? "font-semibold text-bad-fg" : t.state === "watch" ? "font-semibold text-warn-fg" : ""}>{words} · due {day(t.to)}</span>
      </div>
    </div>
  );
}

/** Big percentage with a bar. Bar color follows the score band; the number stays in ink. */
export function ScoreMeter({ score, compact }: { score: number | null; compact?: boolean }) {
  if (score === null) return <p className="text-sm text-muted">Add a deadline to a task to start your score.</p>;
  const color = score >= 80 ? "#08794a" : score >= 50 ? "#a95c18" : "#8a3734";
  return (
    <div>
      <div className="flex items-baseline gap-2"><span className={`${compact ? "text-2xl" : "text-5xl"} font-bold tabular-nums`}>{score}</span><span className="text-lg font-semibold text-muted">%</span></div>
      <div role="meter" aria-label="On-time score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="mt-2 h-2.5 overflow-hidden rounded-full bg-n-150">
        <div className="h-full rounded-full" style={{ width: `${Math.max(score, 2)}%`, background: color }} />
      </div>
    </div>
  );
}

/** Day-by-day bars for my tickets. Each bar runs from the day it was submitted to its deadline, clipped to the window. */
export function Gantt({ bars, days, today, start }: { bars: GanttBar[]; days: string[]; today: string; start: string }) {
  const n = days.length;
  const dense = n > 10;
  const head = (d: string) => {
    const dt = new Date(`${d}T12:00:00`);
    return dense ? String(dt.getDate()) : dt.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
  };
  const todayIdx = days.indexOf(today);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[34rem]">
        <div className="grid items-end border-b border-line pb-2 text-xs text-muted" style={{ gridTemplateColumns: `9rem repeat(${n}, minmax(0, 1fr))` }}>
          <span className="sr-only">Ticket</span><span aria-hidden />
          {days.map((d, i) => <span key={d} className={`text-center ${i === todayIdx ? "font-bold text-brand" : ""}`}>{head(d)}</span>)}
        </div>
        <div className="relative">
          {todayIdx >= 0 && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-brand/70" style={{ left: `calc(9rem + (100% - 9rem) * ${(todayIdx + 0.5) / n})` }} />
          )}
          <ul>
            {bars.map((b) => (
              <li key={b.key} className="grid items-center border-b border-dashed border-line py-2" style={{ gridTemplateColumns: `9rem repeat(${n}, minmax(0, 1fr))` }}>
                <Link href={`/projects/${b.key}`} className="truncate pr-4 text-sm hover:underline" title={`${b.key} · ${b.title}`}>{b.key.replace("MKTGCRTV-", "#")}</Link>
                <Link
                  href={`/projects/${b.key}`}
                  title={`${b.title}: ${b.project.statusName ?? b.project.stage}, ${b.project.startDate || b.project.submittedAt} to ${b.project.deadline}${b.late ? " (late)" : ""}`}
                  className="flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-xs font-medium text-ink"
                  style={{
                    gridColumn: `${b.from + 2} / ${b.to + 3}`,
                    background: `color-mix(in srgb, ${b.color} 22%, var(--card))`,
                    borderLeft: b.clippedLeft ? undefined : `3px solid ${b.color}`,
                    outline: b.late ? "1.5px solid #8a3734" : undefined,
                  }}
                >
                  {b.clippedLeft && <span aria-hidden>◂</span>}
                  <span className="truncate">{b.title}</span>
                  {b.clippedRight && <span aria-hidden className="ml-auto">▸</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <span className="sr-only">Window starts {start}</span>
    </div>
  );
}
