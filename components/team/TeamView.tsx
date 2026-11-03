"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { StaleNotice } from "@/components/ui/StaleNotice";
import { projectsRepo, teamRepo } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import { columnOfProject, COLUMNS, dueLabel } from "@/lib/board";
import { addDay, ganttBars, localDay } from "@/lib/myday/plan";
import { buildLanes, calendarDay, mondayOf, workWeek, type Lane } from "@/lib/team";
import type { Person, Project } from "@/lib/types";
import { PageTitle } from "@/components/PageTitle";

type View = "kanban" | "gantt" | "calendar";
const VIEWS: { id: View; label: string; icon: IconName }[] = [
  { id: "kanban", label: "Kanban", icon: "kanban" }, { id: "gantt", label: "Gantt", icon: "calendarWeek" }, { id: "calendar", label: "Calendar", icon: "calendarDays" },
];
const VIEW_KEY = "team-view";
const LIMIT = 100;
const COLS = COLUMNS.filter((c) => c.id !== "done");
const initialsOf = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const DUE_TONE = { bad: "text-bad-fg font-bold", warn: "text-warn-fg font-bold", muted: "text-muted" } as const;
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", o);

function Person({ name, count }: { name: string; count?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-round bg-brand-dark text-xs font-bold text-n-50">{initialsOf(name)}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{name}</span>
        {count !== undefined && <span className="block text-xs text-muted">{count} open</span>}
      </span>
    </span>
  );
}

/** A ticket as a compact card. The whole card opens the ticket. */
function Card({ p, today }: { p: Project; today: string }) {
  const due = dueLabel(p.deadline, today);
  return (
    <Link href={`/projects/${p.jiraKey}`} className="block rounded-tight border border-line bg-white p-2 text-sm shadow-sm hover:border-brand">
      <span className="line-clamp-2 font-medium">{p.title}</span>
      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        <span className="font-mono text-muted">{p.jiraKey.replace("MKTGCRTV-", "#")}</span>
        {p.flag === "blocked" && <Tag tone="bad" icon="block">Blocked</Tag>}
        {due && <span className={`ml-auto ${DUE_TONE[due.tone]}`}>{due.text}</span>}
      </span>
    </Link>
  );
}

function Queue({ list, members, today, canAssign, busy, onAssign }: { list: Project[]; members: Person[]; today: string; canAssign: boolean; busy: string | null; onAssign: (p: Project, id: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section aria-labelledby="queue-h" className="mb-6 rounded-loose border border-line bg-white p-4">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}><Icon name="chevronRight" size={16} /></span>
        <h2 id="queue-h" className="text-base font-bold">Unassigned queue</h2>
        <Tag tone={list.length ? "warn" : "ok"} icon={list.length ? "alert" : "check"}>{list.length}</Tag>
        <span className="ml-auto text-xs text-muted">Soonest deadline first</span>
      </button>
      {open && (list.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Everything open has someone on it.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <li key={p.jiraKey} className="flex flex-col gap-2">
              <Card p={p} today={today} />
              {canAssign && (
                <select
                  aria-label={`Assign ${p.title}`} value="" disabled={busy === p.jiraKey || members.length === 0}
                  onChange={(e) => e.target.value && onAssign(p, e.target.value)}
                  className="rounded-tight border border-control bg-white px-2 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">{busy === p.jiraKey ? "Assigning…" : members.length ? "Assign to…" : "No team members yet"}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}

function Kanban({ lanes, today }: { lanes: Lane[]; today: string }) {
  return (
    <div className="overflow-x-auto rounded-tight border border-line bg-white">
      <div className="min-w-[56rem]">
        <div className="grid border-b border-line bg-n-100 text-muted eyebrow" style={{ gridTemplateColumns: `12rem repeat(${COLS.length}, minmax(0, 1fr))` }}>
          <span className="p-4">Person</span>
          {COLS.map((c) => <span key={c.id} className="flex items-center gap-2 p-4"><Icon name={c.icon} size={14} /> {c.label}</span>)}
        </div>
        {lanes.map((l) => (
          <div key={l.id} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: `12rem repeat(${COLS.length}, minmax(0, 1fr))` }}>
            <div className="p-4"><Person name={l.name} count={l.projects.length} /></div>
            {COLS.map((c) => {
              const cards = l.projects.filter((p) => columnOfProject(p) === c.id);
              return (
                <ul key={c.id} aria-label={`${l.name}: ${c.label}`} className="space-y-2 border-l border-line p-2">
                  {cards.map((p) => <li key={p.jiraKey}><Card p={p} today={today} /></li>)}
                </ul>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const WINDOWS = [{ id: 14, label: "2 weeks" }, { id: 28, label: "4 weeks" }, { id: 56, label: "8 weeks" }] as const;

function Gantt({ lanes, today }: { lanes: Lane[]; today: string }) {
  const [span, setSpan] = useState<number>(28);
  const [start, setStart] = useState(() => mondayOf(today));
  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDay(start, i)), [start, span]);
  const n = span;
  const todayIdx = days.indexOf(today);
  const cols = `13rem repeat(${n}, minmax(0, 1fr))`;
  return (
    <div className="rounded-loose border border-line bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setStart(addDay(start, -span))} aria-label="Earlier" className="flex h-8 w-8 items-center justify-center rounded-round border border-control hover:bg-n-150"><span className="rotate-180"><Icon name="chevronRight" size={14} /></span></button>
        <button onClick={() => setStart(addDay(start, span))} aria-label="Later" className="flex h-8 w-8 items-center justify-center rounded-round border border-control hover:bg-n-150"><Icon name="chevronRight" size={14} /></button>
        <button onClick={() => setStart(mondayOf(today))} className="btn btn-md btn-secondary">Today</button>
        <span className="font-bold">{fmt(start, { month: "short", day: "numeric" })} – {fmt(days[n - 1], { month: "short", day: "numeric", year: "numeric" })}</span>
        <span className="ml-auto flex gap-2">
          {WINDOWS.map((w) => <button key={w.id} onClick={() => setSpan(w.id)} aria-pressed={span === w.id} className="chip">{w.label}</button>)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[56rem]">
          <div className="grid items-end border-b border-line pb-2 text-xs text-muted" style={{ gridTemplateColumns: cols }}>
            <span className="sr-only">Person and ticket</span><span aria-hidden />
            {days.map((d, i) => {
              const first = fmt(d, { day: "numeric" }) === "1" || i === 0;
              return <span key={d} className={`text-center ${d === today ? "font-bold text-brand" : ""} ${new Date(`${d}T12:00:00`).getDay() % 6 === 0 ? "opacity-50" : ""}`}>{first && n > 14 ? <span className="block text-xs uppercase">{fmt(d, { month: "short" })}</span> : null}{fmt(d, { day: "numeric" })}</span>;
            })}
          </div>
          <div className="relative">
            {todayIdx >= 0 && <div aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-brand/70" style={{ left: `calc(13rem + (100% - 13rem) * ${(todayIdx + 0.5) / n})` }} />}
            {lanes.map((l) => {
              const { bars, undated } = ganttBars(l.projects, start, n, today);
              return (
                <section key={l.id} aria-label={l.name} className="border-b border-line py-2 last:border-b-0">
                  <div className="mb-2"><Person name={l.name} count={l.projects.length} /></div>
                  {bars.length === 0 && <p className="py-2 pl-10 text-xs text-muted">{l.projects.length === 0 ? "Nothing assigned." : "Nothing scheduled in this window."}</p>}
                  <ul>
                    {bars.map((b) => (
                      <li key={b.key} className="grid items-center py-2" style={{ gridTemplateColumns: cols }}>
                        <Link href={`/projects/${b.key}`} className="truncate pr-4 pl-10 text-xs text-muted hover:underline" title={`${b.key} · ${b.title}`}>{b.key.replace("MKTGCRTV-", "#")}</Link>
                        <Link
                          href={`/projects/${b.key}`}
                          title={`${b.title}: ${b.project.statusName ?? b.project.stage}, ${b.project.startDate || b.project.submittedAt} to ${b.project.deadline}${b.late ? " (late)" : ""}`}
                          className="flex h-7 items-center gap-2 overflow-hidden rounded-tight px-2 text-xs font-medium text-ink"
                          style={{ gridColumn: `${b.from + 2} / ${b.to + 3}`, background: `color-mix(in srgb, ${b.color} 22%, var(--card))`, borderLeft: b.clippedLeft ? undefined : `3px solid ${b.color}`, outline: b.late ? "1.5px solid #8a3734" : undefined }}
                        >
                          {b.clippedLeft && <span aria-hidden>◂</span>}
                          <span className="truncate">{b.title}</span>
                          {b.clippedRight && <span aria-hidden className="ml-auto">▸</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {undated > 0 && <p className="pl-10 text-xs text-muted">{undated} without a deadline</p>}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarGrid({ lanes, today }: { lanes: Lane[]; today: string }) {
  const [monday, setMonday] = useState(() => mondayOf(today));
  const week = workWeek(monday);
  const cols = "12rem repeat(5, minmax(0, 1fr))";
  return (
    <div className="rounded-loose border border-line bg-white p-4">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <button onClick={() => setMonday(addDay(monday, -7))} aria-label="Previous week" className="flex h-8 w-8 items-center justify-center rounded-round border border-control hover:bg-n-150"><span className="rotate-180"><Icon name="chevronRight" size={14} /></span></button>
        <button onClick={() => setMonday(addDay(monday, 7))} aria-label="Next week" className="flex h-8 w-8 items-center justify-center rounded-round border border-control hover:bg-n-150"><Icon name="chevronRight" size={14} /></button>
        <button onClick={() => setMonday(mondayOf(today))} className="btn btn-md btn-secondary">This week</button>
        <span className="font-bold">{fmt(week[0], { month: "short", day: "numeric" })} – {fmt(week[4], { month: "short", day: "numeric", year: "numeric" })}</span>
        <span className="ml-auto text-xs text-muted">Shown on the day each ticket is due</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[56rem]">
          <div className="grid border-b border-line pb-2 text-xs font-bold" style={{ gridTemplateColumns: cols }}>
            <span className="sr-only">Person</span><span aria-hidden />
            {week.map((d) => <span key={d} className={`px-2 ${d === today ? "text-brand" : "text-muted"}`}>{fmt(d, { weekday: "short", month: "short", day: "numeric" })}</span>)}
          </div>
          {lanes.map((l) => {
            const placed = l.projects.map((p) => ({ p, at: calendarDay(p.deadline, monday) }));
            const outside = l.projects.length - placed.filter((x) => x.at).length;
            return (
              <div key={l.id} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: cols }}>
                <div className="p-2"><Person name={l.name} count={l.projects.length} />{outside > 0 && <p className="mt-2 pl-10 text-xs text-muted">{outside} due other weeks</p>}</div>
                {week.map((d) => (
                  <ul key={d} aria-label={`${l.name}, ${fmt(d, { weekday: "long", month: "long", day: "numeric" })}`} className={`min-h-16 space-y-2 border-l border-line p-2 ${d === today ? "bg-brand-soft/30" : ""}`}>
                    {placed.filter((x) => x.at?.day === d).map(({ p, at }) => (
                      <li key={p.jiraKey}>
                        <Link href={`/projects/${p.jiraKey}`} title={`${p.title} (${p.jiraKey})`} className={`block truncate rounded-tight border px-2 py-2 text-xs font-medium hover:border-brand ${p.flag === "blocked" ? "border-bad-line bg-bad-bg text-bad-fg" : d < today ? "border-warn-line bg-warn-bg text-warn-fg" : "border-line bg-white"}`}>
                          {at?.weekend && <span className="mr-2 text-xs uppercase text-muted">{at.weekend}</span>}{p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The creative team at a glance: each person's open work as a board, a timeline or a week, plus the queue nobody owns yet. */
export function TeamView() {
  const me = useMe();
  const [view, setView] = useState<View>("kanban");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "kanban" || v === "gantt" || v === "calendar") setView(v); } catch { /* storage unavailable */ }
  }, []);
  const choose = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const load = useCallback(() => {
    if (!me) return;
    Promise.all([projectsRepo.listProjects(me.id, "all", "open", LIMIT), teamRepo.members()])
      .then(([p, m]) => { setProjects(p); setMembers(m); setError(""); })
      .catch((e: Error) => { setProjects((cur) => cur ?? []); setError(e.message); });
  }, [me]);
  useEffect(load, [load]);

  const { lanes, unassigned } = useMemo(() => buildLanes(projects ?? [], members), [projects, members]);
  const assign = async (p: Project, accountId: string) => {
    setBusy(p.jiraKey); setError("");
    const who = members.find((m) => m.id === accountId);
    try {
      await projectsRepo.assign(p.jiraKey, accountId);
      setProjects((cur) => (cur ?? []).map((x) => (x.jiraKey === p.jiraKey ? { ...x, assigneeId: accountId, assigneeName: who?.name } : x)));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't assign that."); } finally { setBusy(null); }
  };

  if (me && me.role !== "creative") return <main className="page [&>*:not(.fixed)]:max-w-3xl"><Callout tone="info" icon="alert">The Team view is for the creative team.</Callout></main>;
  const total = (projects ?? []).filter((p) => p.group !== "closed").length;

  return (
    <main className="page">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <PageTitle>Team</PageTitle>
          <p className="text-sm text-muted">Open work by person, and what still needs an owner.</p>
        </div>
        <div suppressHydrationWarning role="group" aria-label="View" className="ml-auto seg">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => choose(v.id)} aria-pressed={view === v.id} className="seg-item"><Icon name={v.icon} size={14} />{v.label}</button>
          ))}
        </div>
      </div>
      <div className="mb-4"><StaleNotice /></div>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
      {total >= LIMIT && <div className="mb-4"><Callout tone="info" icon="alert">Showing the {LIMIT} most recently updated open tickets.</Callout></div>}

      {projects === null || !today ? <p className="text-sm text-muted">Loading…</p> : (
        <>
          <Queue list={unassigned} members={members} today={today} canAssign={me?.role === "creative"} busy={busy} onAssign={assign} />
          {lanes.length === 0 ? (
            <p className="rounded-tight border border-dashed border-control p-10 text-center text-sm text-muted">No creative team members found yet. People appear here once they&apos;ve signed in and are set as creative in Team &amp; access.</p>
          ) : view === "kanban" ? <Kanban lanes={lanes} today={today} /> : view === "gantt" ? <Gantt lanes={lanes} today={today} /> : <CalendarGrid lanes={lanes} today={today} />}
        </>
      )}
    </main>
  );
}
