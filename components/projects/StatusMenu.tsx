"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Callout, StatusTag } from "@/components/ui/Tag";
import { blocksRepo, projectsRepo } from "@/lib/data";
import type { TargetStatus } from "@/lib/data/blocks";
import type { Project } from "@/lib/types";

/**
 * The ticket's status as a menu. Choosing one moves the ticket in Jira. Only the creative team gets the menu;
 * everyone else sees the plain tag. "Blocked" is left out on purpose: it needs a person named (Mark as blocked).
 */
export function StatusMenu({ project, canChange, onChanged }: { project: Project; canChange: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TargetStatus[] | null>(null);
  const [pending, setPending] = useState<TargetStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const blocked = project.flag === "blocked";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!canChange) return <StatusTag project={project} />;

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setError(null);
    setOptions(null);
    try { setOptions(await blocksRepo.statuses(project.jiraKey)); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the statuses from Jira."); }
  };

  const apply = async (s: TargetStatus) => {
    setBusy(true);
    setError(null);
    try {
      await projectsRepo.moveTo(project.jiraKey, s.name);
      setPending(null);
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the status.");
    }
    setBusy(false);
  };

  const choose = (s: TargetStatus) => (s.category === "done" ? setPending(s) : void apply(s));
  const group = (title: string, items: TargetStatus[]) => items.length > 0 && (
    <li role="none">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul role="none">
        {items.map((s) => (
          <li key={s.name} role="none"><button role="menuitem" disabled={busy} onClick={() => choose(s)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-soft disabled:opacity-50">{s.name}</button></li>
        ))}
      </ul>
    </li>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Status: ${project.statusName ?? project.stage}. Change status`}
        title={blocked ? "Blocked. Use “Mark as unblocked” to move it on." : "Change status (updates Jira)"}
        className="flex items-center gap-1 rounded-full hover:opacity-80"
      >
        <StatusTag project={project} />
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-line bg-white py-1 shadow-lg">
          {blocked ? (
            <p className="px-3 py-2 text-sm text-muted">This ticket is blocked. Use “Mark as unblocked” to choose its next status.</p>
          ) : pending ? (
            <div className="p-3">
              <p className="text-sm font-medium">Move to {pending.name}?</p>
              <p className="mb-3 mt-1 text-xs text-muted">This closes the ticket in Jira.</p>
              <div className="flex gap-2">
                <button autoFocus disabled={busy} onClick={() => apply(pending)} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-n-50 hover:bg-brand-dark disabled:opacity-50">{busy ? "Moving…" : `Move to ${pending.name}`}</button>
                <button onClick={() => setPending(null)} className="rounded-lg border border-control px-3 py-1.5 text-sm font-medium hover:bg-brand-soft">Back</button>
              </div>
            </div>
          ) : options === null && !error ? (
            <p className="px-3 py-2 text-sm text-muted">Loading from Jira…</p>
          ) : (
            <ul role="menu" aria-label="Move to status">
              {options && group("Keep working", options.filter((s) => s.category !== "done"))}
              {options && group("Close it out", options.filter((s) => s.category === "done"))}
              {options && options.length === 0 && <li className="px-3 py-2 text-sm text-muted">Jira doesn&apos;t offer another status right now.</li>}
            </ul>
          )}
          {error && <div className="p-2"><Callout tone="bad" icon="alert">{error}</Callout></div>}
        </div>
      )}
    </div>
  );
}
