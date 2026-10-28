"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Asset } from "@/lib/types";

/** "Item 5 of 5" with previous / next, and a list of every item in the batch. Replaces the row of numbered chips. */
export function BatchStepper({ current, items }: { current: Asset; items: Asset[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const i = items.findIndex((s) => s.id === current.id);
  const prev = items[i - 1], next = items[i + 1];

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  const arrow = (to: Asset | undefined, dir: "prev" | "next") => {
    const cls = "flex h-8 w-8 items-center justify-center rounded-full";
    const icon = <span className={dir === "prev" ? "rotate-180" : ""}><Icon name="chevronRight" size={16} /></span>;
    return to
      ? <Link href={`/review/${to.id}`} aria-label={dir === "prev" ? "Previous item" : "Next item"} className={`${cls} hover:bg-n-150`}>{icon}</Link>
      : <span aria-hidden="true" className={`${cls} opacity-30`}>{icon}</span>;
  };

  return (
    <nav aria-label="Items in this batch" className="flex items-center gap-2">
      {arrow(prev, "prev")}
      <div ref={box} className="relative">
        <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={current.batch?.title} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium hover:bg-n-150">
          Item {i + 1} of {items.length} <Icon name="chevronDown" size={14} />
        </button>
        {open && (
          <ol role="listbox" aria-label={current.batch?.title ?? "Batch"} className="absolute left-0 top-full z-40 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-lg">
            {current.batch && <li className="eyebrow px-4 py-2 text-muted">{current.batch.title}</li>}
            {items.map((s, n) => (
              <li key={s.id} role="option" aria-selected={s.id === current.id}>
                <Link href={`/review/${s.id}`} onClick={() => setOpen(false)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${s.id === current.id ? "bg-brand-soft font-medium" : "hover:bg-n-150"}`}>
                  <span className="w-4 shrink-0 text-xs text-muted">{n + 1}</span><span className="min-w-0 truncate">{s.name}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      {arrow(next, "next")}
    </nav>
  );
}
