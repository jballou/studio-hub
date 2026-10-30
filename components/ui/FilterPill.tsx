"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * A filter as a pill, in the style of Stripe and Linear. Empty: dashed, "+ Status". Set: solid, "× Status | Failed ⌄",
 * the × clears it and the rest opens the choices. `children` renders the choices and gets a function that closes the popover.
 */
export function FilterPill({ label, value, onClear, children, width = "w-56" }: { label: string; value?: string; onClear: () => void; children: (close: () => void) => ReactNode; width?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const set = !!value;

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <div className={`inline-flex h-8 items-center rounded-round border text-sm font-medium transition-colors ${set ? "border-control bg-white" : "border-dashed border-control bg-transparent text-n-800 hover:bg-white"}`}>
        {set && (
          <button type="button" onClick={onClear} aria-label={`Clear ${label} filter`} title="Clear" className="flex h-8 items-center pl-4 pr-2 text-muted hover:text-ink">
            <Icon name="x" size={14} />
          </button>
        )}
        <button
          type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
          className={`flex h-8 items-center gap-2 pr-4 ${set ? "pl-0" : "pl-4"}`}
        >
          {!set && <Icon name="plus" size={14} />}
          <span className={set ? "text-n-800" : ""}>{label}</span>
          {set && <><span className="h-4 w-px bg-line" aria-hidden /><span className="max-w-40 truncate text-brand">{value}</span></>}
          <Icon name="chevronDown" size={14} />
        </button>
      </div>
      {open && (
        <div id={id} role="dialog" aria-label={`Filter by ${label}`} className={`absolute left-0 top-full z-30 mt-2 ${width} rounded-loose border border-line bg-white p-2 shadow-xl`}>
          <p className="px-4 pb-2 pt-2 text-muted eyebrow">{label}</p>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** One row in a filter popover: a check on the chosen one. */
export function FilterOption({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={onSelect} className="flex w-full items-center gap-2 rounded-tight px-4 py-2 text-left text-sm hover:bg-n-150">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-brand">{selected && <Icon name="check" size={14} />}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
