"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string): { y: number; m: number; d: number } | null => {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return r ? { y: +r[1], m: +r[2] - 1, d: +r[3] } : null;
};
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
const shift = (s: string, days: number) => { const p = parse(s)!; const t = new Date(p.y, p.m, p.d + days); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
const label = (s: string) => { const p = parse(s); return p ? new Date(p.y, p.m, p.d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""; };

/**
 * Date field with a calendar popover. Value is "YYYY-MM-DD" (or "" for none), like a native date input.
 * Arrow keys move by day and week, PageUp/PageDown by month, Esc closes.
 */
export function DatePicker({ value, onChange, min, max, placeholder = "Select a date", ariaLabel, className = "", autoFocus = false, align = "left" }: {
  value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string; ariaLabel?: string; className?: string; autoFocus?: boolean; /** which edge of the field the calendar lines up with */ align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<string>("");
  const [view, setView] = useState<{ y: number; m: number }>({ y: 2026, m: 0 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const id = useId();

  const show = (iso0: string) => { const p = parse(iso0)!; setFocus(iso0); setView({ y: p.y, m: p.m }); };
  const openIt = () => { show(parse(value) ? value : todayIso()); setOpen(true); };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const disabled = (s: string) => (!!min && s < min) || (!!max && s > max);

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);

  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [open, focus]);

  useEffect(() => { if (autoFocus) trigger.current?.focus(); }, [autoFocus]);

  const first = new Date(view.y, view.m, 1).getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const cells: string[] = Array.from({ length: 42 }, (_, i) => shift(iso(view.y, view.m, 1), i - first));
  const today = todayIso();
  const go = (delta: number) => { const t = new Date(view.y, view.m + delta, 1); setView({ y: t.getFullYear(), m: t.getMonth() }); };

  const onKey = (e: React.KeyboardEvent) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (step) { e.preventDefault(); show(shift(focus, step)); return; }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const p = parse(focus)!; const t = new Date(p.y, p.m + (e.key === "PageUp" ? -1 : 1), p.d);
      show(iso(t.getFullYear(), t.getMonth(), t.getDate()));
    } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  };

  const pick = (s: string) => { if (disabled(s)) return; onChange(s); close(); };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger} type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : openIt())}
        className={`flex w-full items-center gap-2 rounded-lg border border-control bg-white px-4 py-2 text-left text-sm font-normal hover:border-brand ${className}`}
      >
        <Icon name="calendarDays" size={16} />
        <span className={value ? "" : "text-muted"}>{value ? label(value) : placeholder}</span>
      </button>

      {open && (
        <div id={id} role="dialog" aria-label="Choose a date" onKeyDown={onKey} className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full z-50 mt-2 w-[19rem] rounded-3xl border border-line bg-white p-4 shadow-xl`}>
          <div className="flex items-center rounded-full bg-n-100 p-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm hover:bg-n-150"><span className="rotate-180"><Icon name="chevronRight" size={16} /></span></button>
            <span className="flex-1 text-center text-sm font-semibold" aria-live="polite">{MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={() => go(1)} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm hover:bg-n-150"><Icon name="chevronRight" size={16} /></button>
          </div>

          <div ref={grid} role="grid" className="mt-4 grid grid-cols-7 gap-y-2 text-center" aria-label={`${MONTHS[view.m]} ${view.y}`}>
            {DAYS.map((d) => <span key={d} role="columnheader" className="pb-2 text-xs font-medium uppercase text-muted">{d}</span>)}
            {cells.map((s, i) => {
              const p = parse(s)!;
              const inMonth = p.m === view.m && i >= first && i < first + count;
              const sel = s === value;
              const off = disabled(s);
              return (
                <button
                  key={s} type="button" role="gridcell" data-day={s} tabIndex={s === focus ? 0 : -1} disabled={off} aria-selected={sel} aria-current={s === today ? "date" : undefined}
                  aria-label={new Date(p.y, p.m, p.d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  onClick={() => pick(s)}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                    sel ? "bg-brand font-bold text-n-50 shadow-sm"
                    : off ? "text-n-500 opacity-40"
                    : `hover:bg-n-150 ${inMonth ? "text-ink" : "text-n-500"} ${s === today ? "font-bold ring-2 ring-brand ring-inset" : ""}`
                  }`}
                >
                  {p.d}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { onChange(""); close(); }} className="rounded-full border border-line py-2 text-sm font-medium hover:bg-n-150">Clear</button>
            <button type="button" onClick={() => pick(today)} disabled={disabled(today)} className="rounded-full bg-brand py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
