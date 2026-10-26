"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectsRepo, repo } from "@/lib/data";
import type { BriefInput, ProjectType, User } from "@/lib/types";

const DRAFT_KEY = "brief-draft-v1";
const TYPES: ProjectType[] = ["Social", "Video", "Print", "Web"];

const empty: BriefInput = {
  title: "", problem: "", opportunity: "", scope: "", requirements: "", antiGoals: "",
  deliverables: "", northStar: "", openQuestions: "", deadline: "", assetTypes: [], stakeholderIds: [],
};

const SECTIONS: { key: keyof BriefInput; label: string; hint: string }[] = [
  { key: "problem", label: "Problem statement", hint: "What problem are we solving, and for whom?" },
  { key: "opportunity", label: "Opportunity", hint: "What changes if we get this right?" },
  { key: "scope", label: "Scope", hint: "What is included." },
  { key: "requirements", label: "Requirements", hint: "Must-haves, specs, copy, legal." },
  { key: "antiGoals", label: "Anti-goals", hint: "What this should explicitly not do." },
  { key: "deliverables", label: "Deliverables", hint: "Assets and formats you expect." },
  { key: "northStar", label: "North star", hint: "The one measure of success." },
  { key: "openQuestions", label: "Open questions", hint: "What is still undecided." },
];

export function BriefForm() {
  const [form, setForm] = useState<BriefInput>(empty);
  const [users, setUsers] = useState<User[]>([]);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    repo.listUsers().then(setUsers);
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setForm({ ...empty, ...JSON.parse(raw) });
    } catch { /* ignore corrupt draft */ }
    setHydrated(true);
  }, []);

  // Autosave drafts (debounced).
  useEffect(() => {
    if (!hydrated || key) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); setSaved(true); } catch { /* storage unavailable */ }
    }, 600);
    return () => clearTimeout(t);
  }, [form, hydrated, key]);

  const set = <K extends keyof BriefInput>(k: K, v: BriefInput[K]) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const valid = form.title.trim() && form.problem.trim() && form.deadline && form.assetTypes.length > 0;

  const submit = async () => {
    setSubmitting(true);
    // Real adapter creates the MKTGCRTV issue as the signed-in user (reporter = requester).
    const res = await projectsRepo.createBrief(form, "u-riley");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setKey(res.jiraKey);
    setSubmitting(false);
  };

  if (key) {
    return (
      <main className="mx-auto w-full max-w-2xl p-8">
        <h1 className="mb-2 text-2xl font-bold">Brief submitted</h1>
        <p className="mb-4">Created <span className="rounded bg-line px-1.5 py-0.5 font-mono text-sm">{key}</span>. Follow its status from Projects.</p>
        <Link href="/projects" className="rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Back to projects</Link>
      </main>
    );
  }

  const field = "w-full rounded border border-line bg-white p-2 text-sm";

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">New brief</h1>
        <span className="ml-auto text-xs text-muted">{saved ? "Draft saved" : ""}</span>
      </div>

      <label className="mb-4 block text-sm font-medium">Title
        <input className={`${field} mt-1`} value={form.title} onChange={(e) => set("title", e.target.value)} />
      </label>

      {SECTIONS.map((s) => (
        <label key={s.key} className="mb-4 block text-sm font-medium">{s.label}
          <span className="ml-2 font-normal text-muted">{s.hint}</span>
          <textarea rows={3} className={`${field} mt-1`} value={form[s.key] as string} onChange={(e) => set(s.key, e.target.value)} />
        </label>
      ))}

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">Deadline
          <input type="date" className={`${field} mt-1`} value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium">Asset types</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={form.assetTypes.includes(t)} onChange={() => set("assetTypes", toggle(form.assetTypes, t))} /> {t}</label>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="mb-6 text-sm">
        <legend className="font-medium">Stakeholders <span className="font-normal text-muted">(added as Jira watchers)</span></legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-1"><input type="checkbox" checked={form.stakeholderIds.includes(u.id)} onChange={() => set("stakeholderIds", toggle(form.stakeholderIds, u.id))} /> {u.name}</label>
          ))}
        </div>
      </fieldset>

      <button onClick={submit} disabled={!valid || submitting} className="rounded bg-brand px-5 py-2 font-medium text-white enabled:hover:bg-brand-dark disabled:opacity-40">
        {submitting ? "Submitting…" : "Submit brief"}
      </button>
      {!valid && <p className="mt-2 text-xs text-muted">Title, problem statement, deadline and at least one asset type are required.</p>}
    </main>
  );
}
