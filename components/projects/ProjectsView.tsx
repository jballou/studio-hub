"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { blocksRepo, isJira, projectsRepo, repo, settingsRepo, tasksRepo } from "@/lib/data";
import { FlagTags } from "@/components/blocks/BlockedTag";
import { StarButton } from "@/components/ui/StarButton";
import { useFavorites } from "@/hooks/useFavorites";
import { Callout, StatusTag, Tag } from "@/components/ui/Tag";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/ui/Icon";
import { FilterOption, FilterPill } from "@/components/ui/FilterPill";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { Board } from "./Board";
import { StaleNotice } from "@/components/ui/StaleNotice";
import { NoStartTag, PlanWork } from "./PlanWork";
import { StatusMenu } from "./StatusMenu";
import { DueDateEdit } from "./DueDateEdit";
import { needsStartDate } from "@/lib/startdate";
import { pastDueDays, pastDueWords } from "@/lib/pastdue";
import { lookbackLabel } from "@/lib/settings";
import { useMe } from "@/hooks/useMe";
import { localDay } from "@/lib/myday/plan";
import type { Block, PersonalTask, Project, ProjectGroup, ProjectType, User } from "@/lib/types";
import { PageTitle } from "@/components/PageTitle";

const GROUPS: { id: ProjectGroup; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "ideas", label: "Ideas" },
  { id: "closed", label: "Closed" },
];
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const plusDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };
const DUE_PRESETS: { label: string; at: (today: string) => string }[] = [
  { label: "Today", at: (t) => t },
  { label: "End of this week", at: (t) => plusDays(t, (5 - new Date(`${t}T12:00:00`).getDay() + 7) % 7) },
  { label: "In 7 days", at: (t) => plusDays(t, 7) },
  { label: "In 30 days", at: (t) => plusDays(t, 30) },
];
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
    <div className="rounded-tight border border-line bg-white p-4">
      <div className="mb-4 flex items-center gap-4">
        <button className="rounded-tight border border-control px-2" onClick={() => step(-1)} aria-label="Previous">‹</button>
        <span className="font-bold">{label}</span>
        <button className="rounded-tight border border-control px-2" onClick={() => step(1)} aria-label="Next">›</button>
      </div>
      <div className={`grid gap-px bg-line text-xs ${mode === "week" ? "grid-cols-5" : "grid-cols-7"}`}>
        {(mode === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : ["S", "M", "T", "W", "T", "F", "S"]).map((d, i) => <div key={i} className="bg-n-150 p-2 text-center font-bold">{d}</div>)}
        {days.map((d, i) => (
          <div key={i} className={`bg-white p-2 ${mode === "week" ? "min-h-40" : "min-h-20"}`}>
            {d && <div className="text-muted">{d.getDate()}</div>}
            {d && projects.filter((p) => p.deadline === iso(d)).map((p) => (
              <Link key={p.id} href={`/projects/${p.jiraKey}`} className="mt-2 block truncate rounded-tight bg-brand-soft px-2 py-0 text-xs text-ink">
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

/** Children sit right under their parent when both are in the list; everything else keeps its order. */
function nest(rows: Project[]): { p: Project; depth: number }[] {
  const keys = new Set(rows.map((r) => r.jiraKey));
  const kids = new Map<string, Project[]>();
  const top: Project[] = [];
  for (const r of rows) {
    if (r.parentKey && keys.has(r.parentKey)) kids.set(r.parentKey, [...(kids.get(r.parentKey) ?? []), r]);
    else top.push(r);
  }
  const out: { p: Project; depth: number }[] = [];
  const walk = (p: Project, depth: number) => { out.push({ p, depth }); (kids.get(p.jiraKey) ?? []).forEach((c) => walk(c, Math.min(depth + 1, 3))); };
  top.forEach((p) => walk(p, 0));
  return out;
}

export function ProjectsView() {
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState("u-avery");
  const [openProjects, setOpenProjects] = useState<Project[]>([]);
  // Closed work is fetched only when someone looks at it (the Closed section or the board), which keeps Jira calls down.
  const [closedState, setClosedState] = useState<{ key: string; list: Project[] } | null>(null);
  const [view, setView] = useState<"list" | "board" | "month" | "week">("list");
  const [shelf, setShelf] = useState(false);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [tick, setTick] = useState(0);
  const [closedOpen, setClosedOpen] = useState(false);
  const [lookback, setLookback] = useState<number | null>(null);
  const [today, setToday] = useState("");
  const me = useMe();
  const [action, setAction] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [blocks, setBlocks] = useState<Record<string, Block>>({});
  const favs = useFavorites();
  const [stage, setStage] = useState("");
  const [type, setType] = useState<ProjectType | "">("");
  const [collab, setCollab] = useState("");
  const [before, setBefore] = useState("");

  useEffect(() => { if (!isJira) repo.listUsers().then(setUsers); }, []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const needClosed = closedOpen || view === "board";
  const closedKey = `${meId}|${scope}`;
  const loadBlocks = (list: Project[], live: () => boolean) => blocksRepo.list(list.map((x) => x.jiraKey)).then((bs) => { if (live()) setBlocks((cur) => ({ ...cur, ...Object.fromEntries(bs.map((b) => [b.key, b])) })); }).catch(() => {});

  useEffect(() => {
    let live = true;
    projectsRepo.listProjects(meId, scope, "open").then((p) => {
      if (!live) return;
      setOpenProjects(p);
      setLoadError(null);
      loadBlocks(p, () => live);
    }).catch((e: Error) => { if (live) setLoadError(e.message); });
    return () => { live = false; };
  }, [meId, scope, tick]);

  useEffect(() => {
    if (!needClosed) return;
    let live = true;
    projectsRepo.listProjects(meId, scope, "closed").then((p) => {
      if (!live) return;
      setClosedState({ key: closedKey, list: p });
      loadBlocks(p, () => live);
    }).catch((e: Error) => { if (live) setLoadError(e.message); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needClosed, meId, scope, tick]);

  const closedList = closedState?.key === closedKey ? closedState.list : null;
  const projects = useMemo(() => [...openProjects, ...(closedList ?? [])], [openProjects, closedList]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    tasksRepo.list().then((s) => setTasks(s.tasks)).catch(() => {});
    if (isJira) settingsRepo.get().then((s) => setLookback(s.projectLookbackDays)).catch(() => {});
  }, []);

  const name = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  const actionCount = projects.filter((p) => p.actionRequired).length;
  const newTotal = projects.reduce((n, p) => n + p.newComments, 0);
  const newProjects = projects.filter((p) => p.newComments > 0).length;

  const filtered = useMemo(() => projects.filter((p) =>
    (!action || p.actionRequired) && (!newOnly || p.newComments > 0) && (!starredOnly || favs.isStarred(p.jiraKey)) && (!blockedOnly || p.flag === "blocked" || !!blocks[p.jiraKey]) && (!stage || (p.statusName ?? p.stage) === stage) &&
    (!type || p.type === type) && (!collab || p.collaboratorIds.includes(collab) || p.requesterId === collab || p.assigneeId === collab) &&
    (!before || p.deadline <= before)), [projects, action, newOnly, starredOnly, blockedOnly, blocks, favs, stage, type, collab, before]);

  // Tasks have no type, requester or action state, so ticket-only filters hide them; the due-by date applies to both.
  // Choices come from the tickets on screen, so they are the real Jira statuses and the real people.
  const statusNames = useMemo(() => [...new Set(projects.map((p) => p.statusName ?? p.stage))].sort(), [projects]);
  const people = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) {
      if (p.requesterId && (p.requesterName || users.some((u) => u.id === p.requesterId))) m.set(p.requesterId, p.requesterName ?? name(p.requesterId));
      if (p.assigneeId && (p.assigneeName || users.some((u) => u.id === p.assigneeId))) m.set(p.assigneeId, p.assigneeName ?? name(p.assigneeId));
    }
    return [...m].map(([id, n]) => ({ id, name: n })).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, users]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticketOnlyFilter = action || newOnly || starredOnly || blockedOnly || !!stage || !!type || !!collab;
  const boardTasks = ticketOnlyFilter ? [] : tasks.filter((t) => !before || (t.date ?? "9999") <= before);

  const canPlan = isJira ? me?.role === "creative" : users.find((u) => u.id === meId)?.role === "creative";
  const activeFilters = [action, newOnly, starredOnly, blockedOnly, !!stage, !!type, !!collab, !!before, scope === "all"].filter(Boolean).length;
  const filterCount = [action, newOnly, starredOnly, blockedOnly, !!stage, !!type, !!collab, !!before].filter(Boolean).length;
  const clearFilters = () => { setAction(false); setNewOnly(false); setStarredOnly(false); setBlockedOnly(false); setStage(""); setType(""); setCollab(""); setBefore(""); setScope("mine"); };

  return (
    <main className="page">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <PageTitle>Projects</PageTitle>
        <div className="ml-auto flex items-center gap-4 text-xs">
          {!isJira && <label className="flex items-center gap-2">Viewing as
            <select value={meId} onChange={(e) => setMeId(e.target.value)} className="rounded-tight border border-control px-2 py-2">
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </label>}
          <div suppressHydrationWarning className="seg">
            {([["list", "List", "listStart"], ["board", "Board", "kanban"], ["month", "Month", "calendarDays"], ["week", "Week", "calendarWeek"]] as const).map(([v, label, icon]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="seg-item"><Icon name={icon} size={14} />{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div suppressHydrationWarning className="seg" role="group" aria-label="Which projects">
          {([["mine", "Assigned to you", "userRound"], ["all", "All projects", "folderUsers"]] as const).map(([id, label, icon]) => (
            <button key={id} onClick={() => setScope(id)} aria-pressed={scope === id} className="seg-item"><Icon name={icon} size={14} />{label}</button>
          ))}
        </div>
        <button onClick={() => setShelf(!shelf)} aria-expanded={shelf} aria-controls="filter-shelf" className="chip" data-on={shelf || filterCount > 0}>
          <Icon name="filter" size={16} /> Filters
          {filterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-round bg-brand px-2 text-xs font-bold text-n-50">{filterCount}</span>}
        </button>
        {activeFilters > 0 && <button onClick={clearFilters} className="btn btn-sm btn-ghost text-muted"><Icon name="x" size={14} /> Clear filters</button>}
      </div>
      {shelf && <div id="filter-shelf" className="mb-2 flex flex-wrap items-center gap-2">
        <FilterPill label="Status" value={stage} onClear={() => setStage("")}>
          {(close) => statusNames.map((s) => <FilterOption key={s} label={s} selected={stage === s} onSelect={() => { setStage(s); close(); }} />)}
        </FilterPill>
        <FilterPill label="Type" value={type} onClear={() => setType("")}>
          {(close) => TYPES.map((t) => <FilterOption key={t} label={t} selected={type === t} onSelect={() => { setType(t); close(); }} />)}
        </FilterPill>
        <FilterPill label="Person" value={people.find((u) => u.id === collab)?.name ?? (collab ? "Selected" : "")} onClear={() => setCollab("")}>
          {(close) => people.length === 0 ? <p className="px-4 py-2 text-sm text-muted">No people on these projects yet.</p> : people.map((u) => <FilterOption key={u.id} label={u.name} selected={collab === u.id} onSelect={() => { setCollab(u.id); close(); }} />)}
        </FilterPill>
        <FilterPill label="Due by" value={before ? dayLabel(before) : ""} onClear={() => setBefore("")} width="w-72">
          {(close) => (
            <div>
              {DUE_PRESETS.map((p) => { const d = p.at(localDay()); return <FilterOption key={p.label} label={p.label} selected={before === d} onSelect={() => { setBefore(d); close(); }} />; })}
              <div className="mt-2 border-t border-line p-2"><DatePicker value={before} onChange={(d) => { setBefore(d); close(); }} placeholder="Pick a date" ariaLabel="Due by date" /></div>
            </div>
          )}
        </FilterPill>
        {([[action, setAction, "Action required"], [newOnly, setNewOnly, "New comments"], [starredOnly, setStarredOnly, "Starred"], [blockedOnly, setBlockedOnly, "Blocked"]] as const).map(([on, set, label]) => (
          <button key={label} onClick={() => set(!on)} aria-pressed={on} className="chip">{label}</button>
        ))}
      </div>}
      <p className="mb-4 text-sm text-muted">{scope === "mine" ? "Assigned to you" : "All projects you can see"} · {filtered.length} {filtered.length === 1 ? "project" : "projects"}</p>

      <StaleNotice />
      {loadError && (
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1"><Callout tone="bad" icon="alert">Couldn&apos;t load projects: {loadError}</Callout></div>
          <button onClick={() => setTick((t) => t + 1)} className="btn btn-md btn-secondary">Try again</button>
        </div>
      )}

      {(actionCount > 0 || newTotal > 0) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
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
          const collapsible = g.id === "closed";
          const shown = !collapsible || closedOpen;
          return (
            <section key={g.id} className="mb-6">
              <h2 className="mb-2 text-muted eyebrow">
                {collapsible ? (
                  <button onClick={() => setClosedOpen(!closedOpen)} aria-expanded={closedOpen} className="flex items-center gap-2 rounded-tight hover:text-ink eyebrow">
                    <Icon name={closedOpen ? "chevronDown" : "chevronRight"} size={14} />
                    {g.label} {closedList !== null && <span className="font-normal">({rows.length})</span>}
                  </button>
                ) : <>{g.label} <span className="font-normal">({rows.length})</span></>}
                {collapsible && lookback !== null && <span className="ml-2 text-xs font-normal normal-case tracking-normal">Finished in {lookbackLabel(lookback)}</span>}
              </h2>
              {!shown ? null : collapsible && closedList === null ? <p className="text-sm text-muted">Loading closed projects…</p> : rows.length === 0 ? <p className="text-sm text-muted">Nothing here.</p> : (
                <ul className="space-y-2">
                  {nest(rows).map(({ p, depth }) => (
                    <li key={p.id} style={{ marginLeft: depth * 32 }} className={`flex items-center gap-2 rounded-tight border bg-white pl-2 hover:border-brand border-line`}>
                      <StarButton starred={favs.isStarred(p.jiraKey)} onToggle={() => favs.toggle(p.jiraKey, p.title)} label={p.title} />
                      <Link href={`/projects/${p.jiraKey}`} className="flex min-w-0 flex-1 items-center gap-4 p-4 pl-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                            {p.issueType && <IssueIcon level={p.issueType.level} typeName={p.issueType.name} />}
                            <span className="font-medium">{p.title}</span>
                            <FlagTags flag={p.flag} block={blocks[p.jiraKey]} />
                            {p.actionRequired && <Tag tone="warn" icon="alert">Action required</Tag>}
                            {today && pastDueDays(p, today) !== null && <Tag tone="bad" icon="alert">Past due · {pastDueWords(pastDueDays(p, today)!)}</Tag>}
                            {needsStartDate(p) && <NoStartTag />}
                            {p.newComments > 0 && <Tag tone="info" icon="feedback">{p.newComments} new {p.newComments === 1 ? "comment" : "comments"}</Tag>}
                          </div>
                          <div className="text-xs text-muted">{p.jiraKey} · {p.issueType && p.issueType.level !== 0 ? p.issueType.name : p.type} · {p.requesterName ?? name(p.requesterId)}{p.parentKey && !rows.some((r) => r.jiraKey === p.parentKey) ? ` · in ${p.parentTitle ?? p.parentKey}` : ""}</div>
                        </div>
                        {!canPlan && <StatusTag project={p} />}
                        {!canPlan && <span className={`w-24 text-right text-xs ${today && pastDueDays(p, today) !== null ? "font-bold text-bad-fg" : "text-muted"}`}>{p.deadline ? `Due ${p.deadline}` : "No due date"}</span>}
                      </Link>
                      {canPlan && (
                        <div className="flex shrink-0 items-center gap-4 pr-4">
                          <StatusMenu project={p} canChange onChanged={() => setTick((t) => t + 1)} />
                          <DueDateEdit project={p} late={!!today && pastDueDays(p, today) !== null} onSaved={() => setTick((t) => t + 1)} />
                        </div>
                      )}
                      {needsStartDate(p) && canPlan && <span className="pr-4"><PlanWork project={p} onPlanned={() => setTick((t) => t + 1)} /></span>}
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
