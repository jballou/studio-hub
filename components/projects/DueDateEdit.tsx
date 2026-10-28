"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { projectsRepo } from "@/lib/data";
import type { Project } from "@/lib/types";

/** The due date as a small date picker. Choosing a day saves it to the ticket's Jira due date right away. */
export function DueDateEdit({ project, late, onSaved }: { project: Pick<Project, "jiraKey" | "title" | "deadline" | "startDate">; late: boolean; onSaved: (date: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (date: string) => {
    if (!date || date === project.deadline) return;
    setBusy(true);
    setError(null);
    try {
      await projectsRepo.setDueDate(project.jiraKey, date);
      onSaved(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the due date.");
    }
    setBusy(false);
  };
  return (
    <div className={`w-40 shrink-0 ${busy ? "pointer-events-none opacity-60" : ""}`} title={late ? "Past due" : "Change the due date (updates Jira)"}>
      <DatePicker value={project.deadline} onChange={save} min={project.startDate || undefined} placeholder="No due date" ariaLabel={`Due date for ${project.title}`} className="!py-2 text-xs" align="right" />
      {error && <p role="alert" className="mt-2 text-xs font-medium text-bad-fg">{error}</p>}
    </div>
  );
}
