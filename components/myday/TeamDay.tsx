"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { StaleNotice } from "@/components/ui/StaleNotice";
import { Callout, StatusTag, Tag } from "@/components/ui/Tag";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { teamRepo } from "@/lib/data";
import { addDay, completion, focusList, ganttBars, localDay, onTimeScore, STATUS_META, tileItems, type TileKind } from "@/lib/myday/plan";
import type { Person, Project } from "@/lib/types";
import { Gantt, Gauge, ScoreMeter } from "./Charts";
import { Card, Tile } from "./MyDay";

const WINDOWS = [{ id: "3", label: "3 days", days: 3 }, { id: "7", label: "Week", days: 7 }, { id: "30", label: "Month", days: 30 }] as const;
const KINDS: TileKind[] = ["open", "due", "progress", "blocked", "overdue", "done"];

/** The person / team picker. Only team leads see it. */
export function ViewPicker({ value, members, onChange }: { value: string; members: Person[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold">
      <span className="sr-only md:not-sr-only">Viewing</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Whose work to view" className="rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal">
        <option value="me">My own day</option>
        <option value="all">Team (everyone together)</option>
        <optgroup label="People">
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </optgroup>
      </select>
    </label>
  );
}

/**
 * The Jira side of My Day for one creative, or for everyone together. For team leads.
 * Deliberately has no personal tasks, calendar, notes or reports: those stay private to each person.
 */
export function TeamDay({ person, members, picker, onPick }: { person: string; members: Person[]; picker: React.ReactNode; onPick: (v: string) => void }) {
  const [today, setToday] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [win, setWin] = useState<(typeof WINDOWS)[number]["id"]>("7");
  const [shift, setShift] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setToday(localDay()); }, []);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjects(null);
    teamRepo.work(person).then((r) => { if (live) { setProjects(r.projects); setError(null); } }).catch((e: Error) => { if (live) { setProjects([]); setError(e.message); } });
    return () => { live = false; };
  }, [person]);

  const everyone = person === "all";
  const who = members.find((m) => m.id === person)?.name ?? "this person";
  const list = useMemo(() => projects ?? [], [projects]);
  const tiles = useMemo(() => (today ? Object.fromEntries(KINDS.map((k) => [k, tileItems(k, list, [], today).tickets.length])) as Record<TileKind, number> : null), [list, today]);
  const comp = useMemo(() => completion(list, [], today ?? undefined), [list, today]);
  const score = useMemo(() => (today ? onTimeScore(list, [], today) : null), [list, today]);
  const focus = useMemo(() => (today ? focusList(list, [], today) : []), [list, today]);
  const winDef = WINDOWS.find((w) => w.id === win)!;
  const winStart = today ? addDay(today, shift * winDef.days) : "";
  const days = today ? Array.from({ length: winDef.days }, (_, i) => addDay(winStart, i)) : [];
  const { bars, undated } = useMemo(() => (today ? ganttBars(list, winStart, winDef.days, today) : { bars: [], undated: 0 }), [list, today, winStart, winDef.days]);
  const shownBars = showAll ? bars : bars.slice(0, 8);

  const perPerson = useMemo(() => {
    if (!today || !everyone) return [];
    return members.map((m) => {
      const mine = list.filter((p) => p.assigneeId === m.id);
      const count = (k: TileKind) => tileItems(k, mine, [], today).tickets.length;
      return { m, open: count("open"), due: count("due"), blocked: count("blocked"), overdue: count("overdue"), done: count("done"), score: onTimeScore(mine, [], today).score };
    }).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  }, [list, members, today, everyone]);

  return (
    <main className="page">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <PageTitle>My Day</PageTitle>
          <p className="text-4xl font-bold md:text-5xl">{everyone ? "The whole team" : who}</p>
          <p className="mt-2 text-lg text-muted">{everyone ? "Everyone's Jira work, together" : "Jira work"}</p>
        </div>
        <div className="ml-auto">{picker}</div>
      </div>
      <div className="mt-4"><StaleNotice /></div>
      <div className="mt-4"><Callout tone="info" icon="alert">Team view shows Jira tickets only. Personal tasks, calendars, notes and reports stay private to each person.</Callout></div>
      {error && <div className="mt-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      {projects === null || !tiles ? <p className="mt-6 text-sm text-muted">Loading…</p> : (
        <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_352px]">
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Tile label="Open work" n={tiles.open} note="Open tickets" />
              <Tile label="Due today" n={tiles.due} note="Tickets" />
              <Tile label="In progress" n={tiles.progress} note="Being worked on" />
              <Tile label="Blocked" n={tiles.blocked} note="Waiting on someone" tone={tiles.blocked ? "bad" : undefined} />
              <Tile label="Overdue" n={tiles.overdue} note="Missed deadline" tone={tiles.overdue ? "bad" : undefined} />
              <Tile label="Completed" n={tiles.done} note="Last 14 days" />
            </div>

            {everyone && (
              <div className="mt-4">
                <Card title="By person" hint="Open a person to see their work">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-muted"><tr><th className="pb-2 pr-4 font-medium">Person</th><th className="pb-2 pr-4 font-medium">Open</th><th className="pb-2 pr-4 font-medium">Due today</th><th className="pb-2 pr-4 font-medium">Blocked</th><th className="pb-2 pr-4 font-medium">Overdue</th><th className="pb-2 pr-4 font-medium">Done (14d)</th><th className="pb-2 font-medium">On time</th></tr></thead>
                      <tbody>
                        {perPerson.map((r) => (
                          <tr key={r.m.id} className="border-t border-line">
                            <td className="py-2 pr-4"><button onClick={() => onPick(r.m.id)} className="font-medium text-brand hover:underline">{r.m.name}</button></td>
                            <td className="py-2 pr-4 tabular-nums">{r.open}</td><td className="py-2 pr-4 tabular-nums">{r.due}</td>
                            <td className={`py-2 pr-4 tabular-nums ${r.blocked ? "text-bad-fg font-bold" : ""}`}>{r.blocked}</td>
                            <td className={`py-2 pr-4 tabular-nums ${r.overdue ? "text-bad-fg font-bold" : ""}`}>{r.overdue}</td>
                            <td className="py-2 pr-4 tabular-nums">{r.done}</td>
                            <td className="py-2 tabular-nums">{r.score === null ? "–" : `${r.score}%`}</td>
                          </tr>
                        ))}
                        {perPerson.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No one on the creative team has signed in yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            <div className="mt-4">
              <Card
                title="Project timeline"
                action={
                  <div suppressHydrationWarning className="seg" role="group" aria-label="Timeline length">
                    {WINDOWS.map((w) => <button key={w.id} onClick={() => { setWin(w.id); setShift(0); }} aria-pressed={win === w.id} className="seg-item">{w.label}</button>)}
                  </div>
                }
              >
                {bars.length === 0 ? <p className="py-6 text-center text-sm text-muted">No tickets with dates in this window.</p> : <Gantt bars={shownBars} days={days} today={today!} start={winStart} />}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                  {STATUS_META.filter((m) => m.key !== "tasks").map((m) => <span key={m.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-tight" style={{ background: m.color }} aria-hidden />{m.label}</span>)}
                </div>
                {bars.length > 8 && <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-medium text-brand hover:underline">{showAll ? "Show fewer" : `Show all ${bars.length} tickets`}</button>}
                {undated > 0 && <p className="mt-2 text-xs text-muted">{undated} {undated === 1 ? "ticket has" : "tickets have"} no deadline, so {undated === 1 ? "it isn't" : "they aren't"} on the timeline.</p>}
              </Card>
            </div>

            <div className="mt-4">
              <Card title="Priority" hint="Most urgent first">
                {focus.length === 0 ? <p className="py-4 text-sm text-muted">Nothing open.</p> : (
                  <ul className="space-y-2">
                    {focus.slice(0, 12).map((f) => f.kind === "ticket" && (
                      <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-tight border border-line px-4 py-2">
                        <IssueIcon level={f.project.issueType?.level ?? 0} typeName={f.project.issueType?.name} size={18} />
                        <Link href={`/projects/${f.key}`} className="font-bold hover:underline">{f.title}</Link>
                        <Tag tone={f.reason.startsWith("Overdue") ? "bad" : f.reason.includes("Blocked") ? "warn" : "info"}>{f.reason}</Tag>
                        {everyone && f.project.assigneeName && <span className="text-xs text-muted">{f.project.assigneeName}</span>}
                        <span className="ml-auto"><StatusTag project={f.project} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <div className="min-w-0">
            <Card title="Task completion" hint="Tickets, finished vs open">
              <Gauge
                pct={comp.pct}
                caption={`${comp.done} of ${comp.total} completed`}
                parts={[
                  { key: "done", label: "Completed", color: "var(--color-data-ok)", count: comp.done },
                  { key: "progress", label: "In progress", color: "var(--color-data-progress)", count: comp.progress },
                  { key: "todo", label: "To do", color: "var(--color-data-none)", count: comp.todo },
                ]}
              />
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 flex items-baseline justify-between text-sm"><span className="font-bold">On-time score</span>{score && score.score !== null && <span className="text-xs text-muted">{score.onTime} on time · {score.late} late</span>}</div>
                <ScoreMeter score={score?.score ?? null} compact />
              </div>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
