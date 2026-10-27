"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { blocksRepo, isJira, projectsRepo, repo, tasksRepo } from "@/lib/data";
import { FlagTags } from "@/components/blocks/BlockedTag";
import { StarButton } from "@/components/ui/StarButton";
import { useFavorites } from "@/hooks/useFavorites";
import { Callout, StatusTag, Tag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { Board } from "./Board";
import { NoStartTag, PlanWork } from "./PlanWork";
import { needsStartDate } from "@/lib/startdate";
import { useMe } from "@/hooks/useMe";
import { localDay } from "@/lib/myday/plan";
import type { Block, PersonalTask, Project, ProjectGroup, ProjectType, Stage, User } from "@/lib/types";

const GROUPS: { id: ProjectGroup; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "ideas", label: "Ideas" },
  { id: "closed", label: "Closed" },
];
const STAGES: Stage[] = ["Submitted", "In review", "In progress", "In feedback", "Delivered"];
const TYPES: ProjectType[] = isJira
  ? ["Graphic", "Video", "Web", "Copy", "Campaign", "Other"]
  : ["Social", "Video", "Print", "Web"];

function CalendarMode({ projects, mode }: { projects: Project[]; mode: "month" | "week" }) {
  const [cursor, setCursor] = useState(() => new Date("2026-10-26T00:00:00"));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let days: (Date | null)[];
  if (mode === "week") {
    // Monday to Friday only. Work isn't planned on weekends; anything due then is listed under the grid.
    const start = new Date(year, month, cursor.getDate() - ((cursor.getDay() + 6) % 7));
    days = Array.from({ length: 5 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  } else {
    const first = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    days = Array.from({ length: first + count }, (_, i) => (i < first ? null : new Date(year, month, i - first + 1)));
  }
  const step = (n: number) => setCursor(mode === "week" ? new Date(year, month, cursor.getDate() + 7 * n) : new Date(year, month + n, 1));
  const label = mode === "week" && days[0] && days[4]
    ? `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[4].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <button className="rounded border border-control px-2" onClick={() => step(-1)} aria-label="Previous">‹</button>
        <span className="font-semibold">{label}</span>
        <button className="rounded border border-control px-2" onClick={() => step(1)} aria-label="Next">›</button>
      </div>
      <div className={`grid gap-px bg-line text-xs ${mode === "week" ? "grid-cols-5" : "grid-cols-7"}`}>
        {(mode === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : ["S", "M", "T", "W", "T", "F", "S"]).map((d, i) => <div key={i} className="bg-n-150 p-1 text-center font-semibold">{d}</div>)}
        {days.map((d, i) => (
          <div key={i} className={`bg-white p-1 ${mode === "week" ? "min-h-40" : "min-h-20"}`}>
            {d && <div className="text-muted">{d.getDate()}</div>}
            {d && projects.filter((p) => p.deadline === iso(d)).map((p) => (
              <Link key={p.id} href={`/projects/${p.jiraKey}`} className="mt-1 block truncate rounded bg-brand-soft px-1 py-0.5 text-[11px] text-ink">
                {p.title}
              </Link>
            ))}
          </div>
        ))}
      </div>
      {mode === "week" && days[0] && (() => {
        const sat = iso(new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate() + 5));
        const sun = iso(new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate() + 6));
        const weekend = projects.filter((p) => p.deadline === sat || p.deadline === sun);
        return weekend.length > 0 ? (
          <p className="mt-2 text-xs text-muted">Due this weekend: {weekend.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link href={`/projects/${p.jiraKey}`} className="text-brand underline">{p.title}</Link> ({p.deadline})</span>)}</p>
        ) : null;
      })()}
    </div>
  );
}

export function ProjectsView() {
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState("u-avery");
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"list" | "board" | "month" | "week">("list");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [shelf, setShelf] = useState(false);
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [tick, setTick] = useState(0);
  const [today, setToday] = useState("");
  const me = useMe();
  const [action, setAction] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [blocks, setBlocks] = useState<Record<string, Block>>({});
  const favs = useFavorites();
  const [stage, setStage] = useState<Stage | "">("");
  const [type, setType] = useState<ProjectType | "">("");
  const [collab, setCollab] = useState("");
  const [before, setBefore] = useState("");

  useEffect(() => { if (!isJira) repo.listUsers().then(setUsers); }, []);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    projectsRepo.listProjects(meId, scope).then((p) => {
      if (!live) return;
      setProjects(p);
      setLoadError(null);
      blocksRepo.list(p.map((x) => x.jiraKey)).then((bs) => { if (live) setBlocks(Object.fromEntries(bs.map((b) => [b.key, b]))); }).catch(() => {});
    }).catch((e: Error) => { if (live) setLoadError(e.message); });
    return () => { live = false; };
  }, [meId, scope, tick]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    tasksRepo.list().then((s) => setTasks(s.tasks)).catch(() => {});
  }, []);

  const name = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  const actionCount = projects.filter((p) => p.actionRequired).length;
  const newTotal = projects.reduce((n, p) => n + p.newComments, 0);
  const newProjects = projects.filter((p) => p.newComments > 0).length;

  const filtered = useMemo(() => projects.filter((p) =>
    (!action || p.actionRequired) && (!newOnly || p.newComments > 0) && (!starredOnly || favs.isStarred(p.jiraKey)) && (!blockedOnly || p.flag === "blocked" || !!blocks[p.jiraKey]) && (!stage || p.stage === stage) &&
    (!type || p.type === type) && (!collab || p.collaboratorIds.includes(collab) || p.requesterId === collab) &&
    (!before || p.deadline <= before)), [projects, action, newOnly, starredOnly, blockedOnly, blocks, favs, stage, type, collab, before]);

  // Tasks have no type, requester or action state, so ticket-only filters hide them; the due-by date applies to both.
  const ticketOnlyFilter = action || newOnly || starredOnly || blockedOnly || !!stage || !!type || !!collab;
  const boardTasks = ticketOnlyFilter ? [] : tasks.filter((t) => !before || (t.date ?? "9999") <= before);

  const canPlan = isJira ? me?.role === "creative" : users.find((u) => u.id === meId)?.role === "creative";
  const activeFilters = [action, newOnly, starredOnly, blockedOnly, !!stage, !!type, !!collab, !!before, scope === "all"].filter(Boolean).length;
  const clearFilters = () => { setAction(false); setNewOnly(false); setStarredOnly(false); setBlockedOnly(false); setStage(""); setType(""); setCollab(""); setBefore(""); setScope("mine"); };

  return (
    <main className={`mx-auto w-full p-6 ${view === "board" ? "max-w-7xl" : "max-w-5xl"}`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {!isJira && <label className="flex items-center gap-1">Viewing as
            <select value={meId} onChange={(e) => setMeId(e.target.value)} className="rounded border border-control px-1 py-1">
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </label>}
          <div className="flex overflow-hidden rounded border border-line">
            {([["list", "listStart"], ["board", "kanban"], ["month", "calendarDays"], ["week", "calendarWeek"]] as const).map(([v, icon]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`flex items-center gap-1.5 px-3 py-1 capitalize ${view === v ? "bg-brand text-white" : "bg-white"}`}><Icon name={icon} size={14} />{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShelf(!shelf)}
          aria-expanded={shelf}
          aria-controls="filter-shelf"
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-brand-soft ${activeFilters ? "border-brand bg-brand-soft" : "border-control bg-white"}`}
        >
          <Icon name="filter" size={16} /> Filters
          {activeFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-n-50">{activeFilters}</span>}
        </button>
        <span className="text-sm text-muted">{scope === "mine" ? "Assigned to you" : "All projects you can see"} · {filtered.length} {filtered.length === 1 ? "project" : "projects"}</span>
        {activeFilters > 0 && <button onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">Reset</button>}
      </div>

      {shelf && (
        <div id="filter-shelf" className="mb-6 space-y-3 rounded-xl border border-line bg-white p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Show</span>
            <div className="flex overflow-hidden rounded border border-line" role="group" aria-label="Which projects">
              {([["mine", "Assigned to me"], ["all", "All projects"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setScope(id)} aria-pressed={scope === id} className={`px-3 py-1 ${scope === id ? "bg-brand text-white" : "bg-white"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1"><input type="checkbox" checked={action} onChange={(e) => setAction(e.target.checked)} /> Action required</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} /> New comments</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} /> Starred</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} /> Blocked</label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
        </div>
      )}

      {loadError && <div className="mb-4"><Callout tone="bad" icon="alert">Couldn&apos;t load projects: {loadError}</Callout></div>}

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

      {view === "board" ? (
        <Board
          projects={filtered} tasks={boardTasks} blocks={blocks} today={today || "1970-01-01"}
          canMove={canPlan} onPlanned={() => setTick((t) => t + 1)}
          isStarred={favs.isStarred} toggleStar={favs.toggle} onTicketsChanged={() => setTick((t) => t + 1)} onTasks={setTasks}
        />
      ) : view !== "list" ? <CalendarMode projects={filtered} mode={view} /> : (
        GROUPS.map((g) => {
          const rows = filtered.filter((p) => p.group === g.id);
          return (
            <section key={g.id} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{g.label} <span className="font-normal">({rows.length})</span></h2>
              {rows.length === 0 ? <p className="text-sm text-muted">Nothing here.</p> : (
                <ul className="space-y-2">
                  {rows.map((p) => (
                    <li key={p.id} className="flex items-center gap-1 rounded-lg border border-line bg-white pl-2 hover:border-brand">
                      <StarButton starred={favs.isStarred(p.jiraKey)} onToggle={() => favs.toggle(p.jiraKey, p.title)} label={p.title} />
                      <Link href={`/projects/${p.jiraKey}`} className="flex min-w-0 flex-1 items-center gap-4 p-3 pl-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium">{p.title}</span>
                            <FlagTags flag={p.flag} block={blocks[p.jiraKey]} />
                            {p.actionRequired && <Tag tone="warn" icon="alert">Action required</Tag>}
                            {needsStartDate(p) && <NoStartTag />}
                            {p.newComments > 0 && <Tag tone="info" icon="feedback">{p.newComments} new {p.newComments === 1 ? "comment" : "comments"}</Tag>}
                          </div>
                          <div className="text-xs text-muted">{p.jiraKey} · {p.type} · {p.requesterName ?? name(p.requesterId)}</div>
                        </div>
                        <StatusTag project={p} />
                        <span className="w-24 text-right text-xs text-muted">{p.deadline ? `Due ${p.deadline}` : "No due date"}</span>
                      </Link>
                      {needsStartDate(p) && canPlan && <span className="pr-3"><PlanWork project={p} onPlanned={() => setTick((t) => t + 1)} /></span>}
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
