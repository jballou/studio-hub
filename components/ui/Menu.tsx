"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type MenuItem =
  | { kind?: "item"; label: string; icon?: IconName; onSelect: () => void; danger?: boolean; disabled?: boolean; /** a check mark in front, for on/off choices */ checked?: boolean; hint?: string }
  | { kind: "divider" }
  | { kind: "custom"; node: ReactNode };

/** A "…" button that opens a small menu. Closes on outside click, Escape or choosing an item. */
export function Menu({ label = "More options", items, align = "right", size = 32 }: { label?: string; items: MenuItem[]; align?: "left" | "right"; size?: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

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
      <button
        type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} title={label}
        className="flex items-center justify-center rounded-full text-n-800 hover:bg-n-150" style={{ width: size, height: size }}
      >
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div id={id} role="menu" onClick={(e) => e.stopPropagation()} className={`absolute top-full z-40 mt-2 min-w-56 max-w-80 rounded-xl border border-line bg-white p-2 text-sm shadow-lg ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((it, i) => {
            if (it.kind === "divider") return <div key={i} role="separator" className="my-2 border-t border-line" />;
            if (it.kind === "custom") return <div key={i} className="px-4 py-2">{it.node}</div>;
            return (
              <button
                key={i} role="menuitem" disabled={it.disabled}
                onClick={() => { setOpen(false); it.onSelect(); }}
                className={`flex w-full items-center gap-2 rounded-lg px-4 py-2 text-left font-medium disabled:opacity-40 ${it.danger ? "text-bad-fg hover:bg-bad-bg" : "hover:bg-n-150"}`}
              >
                <span className="flex w-4 shrink-0 justify-center">{it.checked ? <Icon name="check" size={14} /> : it.icon ? <Icon name={it.icon} size={16} /> : null}</span>
                <span className="min-w-0 flex-1">{it.label}{it.hint && <span className="block text-xs font-normal text-muted">{it.hint}</span>}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
