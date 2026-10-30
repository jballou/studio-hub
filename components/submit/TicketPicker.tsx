"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { projectsRepo } from "@/lib/data";
import type { Project } from "@/lib/types";

/**
 * Type-ahead Jira ticket picker. Matches on key, number ("101") or title, so nobody
 * scrolls a long list. Results come from projectsRepo.searchProjects (a Jira search later).
 */
export function TicketPicker({
  value, onChange, viewerId,
}: {
  value: Project | null;
  onChange: (p: Project | null) => void;
  viewerId: string;
}) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Project[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Debounced search; stale responses are dropped.
  useEffect(() => {
    if (!open) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    const t = setTimeout(() => {
      projectsRepo.searchProjects(viewerId, q).then((r) => {
        if (!live) return;
        setHits(r);
        setActive(0);
        setBusy(false);
      });
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, viewerId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (p: Project) => {
    onChange(p);
    setQ("");
    setOpen(false);
  };

  if (value && !open) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal">
        <span className="font-mono text-xs">{value.jiraKey}</span>
        <span className="min-w-0 flex-1 truncate">{value.title}</span>
        <button type="button" onClick={() => { setOpen(true); }} className="text-xs font-medium text-brand hover:underline">Change</button>
        <button type="button" onClick={() => onChange(null)} aria-label="Clear ticket" className="flex h-5 w-5 items-center justify-center rounded-round hover:bg-n-150"><Icon name="x" size={12} /></button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative mt-2">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><Icon name="search" size={14} /></span>
      <input
        id="ticket-search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Jira ticket"
        autoComplete="off"
        autoFocus={!!value}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open && hits[active]) { e.preventDefault(); choose(hits[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search by number or title, e.g. 101"
        className="w-full rounded-tight border border-control bg-white py-2 pl-10 pr-4 text-sm font-normal"
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-loose border border-line bg-white p-2 shadow-lg">
          {hits.length === 0 && <li className="px-4 py-4 text-center text-sm font-normal text-muted">{busy ? "Searching…" : "No matching tickets."}</li>}
          {hits.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`flex w-full items-baseline gap-2 rounded-tight px-4 py-2 text-left text-sm font-normal ${i === active ? "bg-brand-soft" : ""}`}
              >
                <span className="font-mono text-xs">{p.jiraKey}</span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
