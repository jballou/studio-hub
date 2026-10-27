"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { projectsRepo } from "@/lib/data";
import { localDay } from "@/lib/myday/plan";
import { startDateProblem } from "@/lib/startdate";
import type { Project } from "@/lib/types";

/** The flag shown on open tickets with an empty Start date. */
export function NoStartTag() {
  return <Tag tone="warn" icon="calendarDays" title="Plan when work on this ticket starts">No start date set</Tag>;
}

/**
 * "Plan work": start the work today, or choose a start date with the calendar picker. Saves to the ticket's Jira Start date.
 * Renders nothing for people who can't plan work or for tickets that already have a date.
 */
export function PlanWork({ project, onPlanned, size = "sm" }: { project: Pick<Project, "jiraKey" | "title" | "deadline">; onPlanned: (date: string) => void; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand font-medium text-brand hover:bg-brand-soft ${size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"}`}
      >
        <Icon name="calendarDays" size={size === "md" ? 16 : 14} /> Plan work
      </button>
      {open && <PlanDialog project={project} onClose={() => setOpen(false)} onSaved={(d) => { setOpen(false); onPlanned(d); }} />}
    </>
  );
}

function PlanDialog({ project, onClose, onSaved }: { project: Pick<Project, "jiraKey" | "title" | "deadline">; onClose: () => void; onSaved: (date: string) => void }) {
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (d: string) => {
    const problem = startDateProblem(d, project.deadline);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      await projectsRepo.setStartDate(project.jiraKey, d);
      onSaved(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the start date.");
      setBusy(false);
    }
  };

  const today = localDay();
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-n-1000/40 p-4 pt-[14vh]" onMouseDown={(e) => { e.stopPropagation(); onClose(); }} onClick={(e) => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-label={`Plan work on ${project.jiraKey}`} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold">Plan work</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{project.jiraKey} · {project.title}. When does work start?{project.deadline ? ` Due ${project.deadline}.` : ""}</p>
        {error && <div className="mb-3"><Callout tone="bad" icon="alert">{error}</Callout></div>}
        <div className="space-y-2">
          <button autoFocus disabled={busy} onClick={() => save(today)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-50">
            Start today
          </button>
          {!picking ? (
            <button disabled={busy} onClick={() => setPicking(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-control px-4 py-2.5 text-sm font-medium hover:bg-brand-soft">
              <Icon name="calendarDays" size={16} /> Choose a start date
            </button>
          ) : (
            <div className="rounded-lg border border-control p-3">
              <label className="block text-sm font-semibold">Start date
                <input type="date" autoFocus value={date} max={project.deadline || undefined} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-control bg-white px-3 py-2 text-sm font-normal" />
              </label>
              <button disabled={busy || !date} onClick={() => save(date)} className="mt-2 w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">{busy ? "Saving…" : "Save start date"}</button>
            </div>
          )}
        </div>
        <button onClick={onClose} className="mt-3 text-sm font-medium text-brand hover:underline">Cancel</button>
      </div>
    </div>
  );
}
