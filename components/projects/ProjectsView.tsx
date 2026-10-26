"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { projectsRepo, repo } from "@/lib/data";
import { Callout, StageTag, Tag } from "@/components/ui/Tag";
import type { Project, ProjectGroup, ProjectType, Stage, User } from "@/lib/types";

const GROUPS: { id: ProjectGroup; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "ideas", label: "Ideas" },
  { id: "closed", label: "Closed" },
];
const STAGES: Stage[] = ["Submitted", "In review", "In progress", "In feedback", "Delivered"];
const TYPES: ProjectType[] = ["Social", "Video", "Print", "Web"];

function MonthCalendar({ projects }: { projects: Project[] }) {
  const [cursor, setCursor] = useState(() => new Date("2026-10-01T00:00:00"));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first + days }, (_, i) => (i < first ? null : i - first + 1));
  const byDay = (d: number) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return projects.filter((p) => p.deadline === key);
  };
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <button className="rounded border border-control px-2" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">‹</button>
        <span className="font-semibold">{cursor.toLocaleString("en-US", { month: "long", year: "numeric" })}</span>
        <button className="rounded border border-control px-2" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-line text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="bg-n-150 p-1 text-center font-semibold">{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} className="min-h-20 bg-white p-1">
            {d && <div className="text-muted">{d}</div>}
            {d && byDay(d).map((p) => (
              <Link key={p.id} href={`/review/${p.assetIds[0] ?? ""}`} className="mt-1 block truncate rounded bg-brand-soft px-1 py-0.5 text-[11px] text-ink">
                {p.title}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectsView() {
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState("u-avery");
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [action, setAction] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [stage, setStage] = useState<Stage | "">("");
  const [type, setType] = useState<ProjectType | "">("");
  const [collab, setCollab] = useState("");
  const [before, setBefore] = useState("");

  useEffect(() => { repo.listUsers().then(setUsers); }, []);
  useEffect(() => {
    let live = true;
    projectsRepo.listProjects(meId).then((p) => { if (live) setProjects(p); });
    return () => { live = false; };
  }, [meId]);

  const name = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  const actionCount = projects.filter((p) => p.actionRequired).length;
  const newTotal = projects.reduce((n, p) => n + p.newComments, 0);
  const newProjects = projects.filter((p) => p.newComments > 0).length;

  const filtered = useMemo(() => projects.filter((p) =>
    (!action || p.actionRequired) && (!newOnly || p.newComments > 0) && (!stage || p.stage === stage) &&
    (!type || p.type === type) && (!collab || p.collaboratorIds.includes(collab) || p.requesterId === collab) &&
    (!before || p.deadline <= before)), [projects, action, newOnly, stage, type, collab, before]);

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1">Viewing as
            <select value={meId} onChange={(e) => setMeId(e.target.value)} className="rounded border border-control px-1 py-1">
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </label>
          <div className="flex overflow-hidden rounded border border-line">
            {(["list", "calendar"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-3 py-1 capitalize ${view === v ? "bg-brand text-white" : "bg-white"}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1"><input type="checkbox" checked={action} onChange={(e) => setAction(e.target.checked)} /> Action required</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} /> New comments</label>
        <select aria-label="Status" value={stage} onChange={(e) => setStage(e.target.value as Stage | "")} className="rounded border border-control px-2 py-1">
          <option value="">Any status</option>{STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as ProjectType | "")} className="rounded border border-control px-2 py-1">
          <option value="">Any type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select aria-label="Collaborator" value={collab} onChange={(e) => setCollab(e.target.value)} className="rounded border border-control px-2 py-1">
          <option value="">Anyone</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="flex items-center gap-1">Due by <input type="date" value={before} onChange={(e) => setBefore(e.target.value)} className="rounded border border-control px-2 py-1" /></label>
      </div>

      {(actionCount > 0 || newTotal > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {actionCount > 0 && (
            <Callout tone="warn" icon="alert">
              {actionCount === 1 ? "1 project needs" : `${actionCount} projects need`} your action
            </Callout>
          )}
          {newTotal > 0 && (
            <Callout tone="info" icon="feedback">
              {newTotal} new {newTotal === 1 ? "comment" : "comments"} on {newProjects} {newProjects === 1 ? "project" : "projects"}
            </Callout>
          )}
        </div>
      )}

      {view === "calendar" ? <MonthCalendar projects={filtered} /> : (
        GROUPS.map((g) => {
          const rows = filtered.filter((p) => p.group === g.id);
          return (
            <section key={g.id} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{g.label} <span className="font-normal">({rows.length})</span></h2>
              {rows.length === 0 ? <p className="text-sm text-muted">Nothing here.</p> : (
                <ul className="space-y-2">
                  {rows.map((p) => (
                    <li key={p.id}>
                      <Link href={p.assetIds[0] ? `/review/${p.assetIds[0]}` : "/projects"} className="flex items-center gap-4 rounded-lg border border-line bg-white p-3 hover:border-brand">
                        <div className="flex w-14 gap-1">
                          {p.assetIds.slice(0, 2).map((a) => <span key={a} className="h-10 w-10 rounded bg-brand-soft" aria-hidden />)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium">{p.title}</span>
                            {p.actionRequired && <Tag tone="warn" icon="alert">Action required</Tag>}
                            {p.newComments > 0 && <Tag tone="info" icon="feedback">{p.newComments} new {p.newComments === 1 ? "comment" : "comments"}</Tag>}
                          </div>
                          <div className="text-xs text-muted">{p.jiraKey} · {p.type} · {name(p.requesterId)}</div>
                        </div>
                        <StageTag stage={p.stage} />
                        <span className="w-24 text-right text-xs text-muted">Due {p.deadline}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
