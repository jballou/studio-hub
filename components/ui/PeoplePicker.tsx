"use client";

import { useEffect, useId, useRef, useState } from "react";
import { peopleRepo } from "@/lib/data/people";
import type { Person } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Multi-select people picker: type a name, pick from the matches, repeat. Chosen people show as removable chips.
 * Results come from peopleRepo (Jira user search when signed in; demo users otherwise).
 */
export function PeoplePicker({
  label, hint, value, onChange, placeholder = "Search by name", max,
}: {
  label: string;
  hint?: string;
  value: Person[];
  onChange: (people: Person[]) => void;
  placeholder?: string;
  /** limit how many people can be chosen (e.g. 1 for "blocked by") */
  max?: number;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Person[]>([]);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Debounced search; stale responses are dropped.
  useEffect(() => {
    if (!open || !q.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([]);
      return;
    }
    let live = true;
    setState("loading");
    const t = setTimeout(() => {
      peopleRepo.search(q).then(
        (r) => { if (live) { setHits(r.filter((p) => !value.some((v) => v.id === p.id))); setActive(0); setState("idle"); } },
        (e: Error) => { if (live) { setState("error"); setError(e.message); } },
      );
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const add = (p: Person) => {
    onChange([...value, p]);
    setQ("");
    setHits([]);
  };

  return (
    <div ref={box} className="text-sm">
      <label htmlFor={id} className="mb-2 block font-bold">{label}</label>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-tight border border-control bg-white px-2 py-2">
          {value.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-round border border-brand bg-brand-soft py-0 pl-4 pr-2 text-sm">
              {p.name}
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`} className="flex h-5 w-5 items-center justify-center rounded-round hover:bg-white/60">
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {(max === undefined || value.length < max) && <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            autoComplete="off"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter" && open && hits[active]) { e.preventDefault(); add(hits[active]); }
              else if (e.key === "Escape") setOpen(false);
              else if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
            }}
            placeholder={value.length ? "Add another" : placeholder}
            className="min-w-32 flex-1 bg-transparent py-0 font-normal outline-none"
          />}
        </div>
        {open && q.trim() && (
          <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-loose border border-line bg-white p-2 shadow-lg">
            {state === "error" && <li className="px-4 py-2 text-bad-fg">{error}</li>}
            {state !== "error" && hits.length === 0 && <li className="px-4 py-4 text-center text-muted">{state === "loading" ? "Searching…" : "No one found."}</li>}
            {hits.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => add(p)} className={`flex w-full items-baseline gap-2 rounded-tight px-4 py-2 text-left ${i === active ? "bg-brand-soft" : ""}`}>
                  <span className="font-medium">{p.name}</span>
                  {p.email && <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <p className="mt-2 text-xs font-normal text-muted">{hint}</p>}
    </div>
  );
}
