"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/ui/Icon";
import { greetingFor } from "@/lib/greeting";
import { Callout, StatusTag, Tag } from "@/components/ui/Tag";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { StaleNotice } from "@/components/ui/StaleNotice";
import { pastDueDays, pastDueWords } from "@/lib/pastdue";
import { activityRepo, googleRepo, GoogleUnavailable, isJira, projectsRepo, tasksRepo, type ActivityItem, type GoogleStatus } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import { celebrate } from "@/lib/celebrate";
import { addDay, completion, focusList, ganttBars, hm, localDay, minutes, onTimeScore, openSlots, relativeTime, suggest, taskInstant, timeline, tileItems, type TileKind, STAGES_ORDER, STATUS_META, type DayEvent, type FocusItem } from "@/lib/myday/plan";
import { Gantt, Gauge, ScoreMeter, TimelineMeter } from "./Charts";
import { NoStartTag, PlanWork } from "@/components/projects/PlanWork";
import { needsStartDate } from "@/lib/startdate";
import { PlanWorkCard } from "./PlanWorkCard";
import { localTimezone, timezoneOptions, zoneAbbr } from "@/lib/time";
import type { PersonalTask, Project } from "@/lib/types";

const FLASH: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "Google is connected. Your calendar events show up here, and your tasks are backed up to Google Tasks." },
  denied: { tone: "warn", text: "Google wasn't connected because the request was cancelled." },
  partial: { tone: "warn", text: "Google needs both permissions (calendar and tasks) to work. Connect again and leave both ticked." },
  "wrong-account": { tone: "bad", text: "Use your @surveymonkey.com Google account to connect." },
  failed: { tone: "bad", text: "Something went wrong connecting Google. Try again." },
  "not-configured": { tone: "warn", text: "Google isn't set up for this app yet. An admin needs to add the Google client credentials." },
};

const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const field = "rounded-tight border border-control bg-white px-4 py-2 text-sm";

function BackupTag({ t }: { t: PersonalTask }) {
  if (t.backup === "synced") return <Tag tone="ok">In Google Tasks</Tag>;
  if (t.backup === "pending") return <Tag tone="warn">Backup pending</Tag>;
  return null;
}

function dueText(t: PersonalTask, tz: string): string {
  if (!t.date) return "No date";
  const d = new Date(`${t.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!t.time) return d;
  const [h, m] = t.time.split(":").map(Number);
  const zone = t.tz ?? tz;
  return `${d}, ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"} ${zoneAbbr(zone)}`;
}

const WINDOWS = [{ id: "3", label: "3 days", days: 3 }, { id: "7", label: "Week", days: 7 }, { id: "30", label: "Month", days: 30 }] as const;

export function MyDay() {
  const me = useMe();
  const params = useSearchParams();
  const flashKey = params.get("google");
  const wantsNewTask = params.get("new") === "task";
  const [today, setToday] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [tz] = useState(localTimezone);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<PersonalTask[] | null>(null);
  const [events, setEvents] = useState<DayEvent[] | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [eventsErr, setEventsErr] = useState<{ message: string; code?: string } | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [taskErr, setTaskErr] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(wantsNewTask);
  const [tab, setTab] = useState<"priority" | "tasks">("priority");
  const [win, setWin] = useState<(typeof WINDOWS)[number]["id"]>("3");
  const [shift, setShift] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const [showAllFocus, setShowAllFocus] = useState(false);
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAllBars, setShowAllBars] = useState(false);
  const [tileOpen, setTileOpen] = useState<TileKind | null>(null);
  const [jiraErr, setJiraErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    if (!wantsNewTask) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdding(true);
    window.history.replaceState(null, "", "/my-day");
  }, [wantsNewTask]);

  useEffect(() => {
    // The date is read in the browser so "today" is the person's own day, not the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    setNow(Date.now());
    setHour(new Date().getHours());
  }, []);

  const applyTasks = useCallback((s: { tasks: PersonalTask[]; syncError?: string }) => { setTasks(s.tasks); setSyncErr(s.syncError ?? null); }, []);

  useEffect(() => {
    if (!me || !today) return;
    let live = true;
    projectsRepo.myWork(me.id).then((p) => { if (live) { setProjects(p); setJiraErr(null); } }).catch((e) => { if (live) { setProjects([]); setJiraErr(e instanceof Error ? e.message : "Couldn't load your tickets."); } });
    tasksRepo.list().then((s) => live && applyTasks(s)).catch((e) => { if (live) { setTasks([]); setTaskErr(e.message); } });
    googleRepo.status().then((s) => live && setGoogle(s)).catch(() => live && setGoogle(null));
    activityRepo.recent().then((a) => live && setActivity(a)).catch(() => live && setActivity([]));
    const start = new Date(`${today}T00:00:00`), end = new Date(`${today}T23:59:59`);
    googleRepo.events(start.toISOString(), end.toISOString())
      .then((e) => { if (live) { setEvents(e); setEventsErr(null); } })
      .catch((e) => { if (live) { setEvents([]); setEventsErr({ message: e.message, code: e instanceof GoogleUnavailable ? e.code : undefined }); } });
    return () => { live = false; };
  }, [me, today, applyTasks, reload]);

  const slots = useMemo(() => (today && events ? openSlots(events, tasks ?? [], today, now, tz) : []), [events, tasks, today, now, tz]);
  const focus = useMemo(() => (today && projects ? focusList(projects, tasks ?? [], today) : []), [projects, tasks, today]);
  const plan = useMemo(() => suggest(focus, slots), [focus, slots]);
  const planned = new Set(plan.map((p) => p.item.id));

  const schedule = useMemo(() => {
    if (!today) return [];
    const rows: { at: number; end?: number; label: string; kind: "meeting" | "task"; link?: string; allDay?: boolean }[] = [];
    for (const e of events ?? []) rows.push({ at: e.allDay ? 0 : +new Date(e.start), end: e.allDay ? undefined : +new Date(e.end), label: e.title, kind: "meeting", link: e.meetLink ?? e.link, allDay: e.allDay });
    for (const t of tasks ?? []) {
      if (t.done || t.date !== today) continue;
      const at = taskInstant(t, tz);
      if (at !== null) rows.push({ at, label: t.title, kind: "task" });
    }
    return rows.sort((a, b) => a.at - b.at);
  }, [events, tasks, today, tz]);

  const act = async (fn: () => Promise<{ tasks: PersonalTask[]; syncError?: string }>) => {
    setTaskErr(null);
    try { applyTasks(await fn()); } catch (e) { setTaskErr(e instanceof Error ? e.message : "Couldn't save that."); }
  };

  const loading = !today || projects === null || tasks === null || events === null;
  const flash = flashKey ? FLASH[flashKey] : null;
  const open = (tasks ?? []).filter((t) => !t.done).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? ""));
  const done = (tasks ?? []).filter((t) => t.done);
  const dateLabel = today ? new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";

  const score = useMemo(() => (today && projects ? onTimeScore(projects, tasks ?? [], today) : null), [projects, tasks, today]);
  const comp = useMemo(() => completion(projects ?? [], tasks ?? [], today ?? undefined), [projects, tasks, today]);
  // Each tile's number is the length of the list it opens, so the two can never disagree.
  const tiles = useMemo(() => {
    const at = (k: TileKind) => (today ? tileItems(k, projects ?? [], tasks ?? [], today) : { tickets: [], tasks: [] });
    const n = (k: TileKind) => { const i = at(k); return { items: i, count: i.tickets.length + i.tasks.length }; };
    return { open: n("open"), due: n("due"), progress: n("progress"), blocked: n("blocked"), overdue: n("overdue"), done: n("done") };
  }, [projects, tasks, today]);
  const dueToday = tiles.due.count;
  const overdue = tiles.overdue.count;

  // Timeline window. The 3-day view starts today; arrows move it by its own length.
  const winDef = WINDOWS.find((w) => w.id === win)!;
  const winStart = today ? addDay(today, shift * winDef.days) : "";
  const days = today ? Array.from({ length: winDef.days }, (_, i) => addDay(winStart, i)) : [];
  const { bars, undated } = useMemo(() => (today && projects ? ganttBars(projects, winStart, winDef.days, today) : { bars: [], undated: 0 }), [projects, today, winStart, winDef.days]);
  const shownBars = showAllBars ? bars : bars.slice(0, 6);

  const upcoming = schedule.filter((r) => r.allDay || (r.end ?? r.at) >= now);
  const next = schedule.find((r) => !r.allDay && r.kind === "meeting" && (r.end ?? r.at) >= now);
  const shownSchedule = showAllSchedule ? schedule : upcoming.filter((r) => r !== next).slice(0, 3);
  const shownFocus = showAllFocus ? focus : focus.slice(0, 4);
  const shownTasks = showAllTasks ? open : open.slice(0, 5);
  const bigSlot = [...slots].sort((a, b) => b.end - b.start - (a.end - a.start))[0];

  return (
    <main className="page">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold md:text-5xl">{me?.name ? `${greetingFor(hour)}, ${me.name.split(" ")[0]}` : "My Day"}</h1>
          <p className="mt-2 text-lg text-muted">{dateLabel}</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn btn-md btn-primary ml-auto"><Icon name="plus" size={16} /> Add new task</button>
      </div>
      <div className="mt-4"><StaleNotice /></div>
      {jiraErr && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1"><Callout tone="bad" icon="alert">Couldn&apos;t load your Jira tickets: {jiraErr}</Callout></div>
          <button onClick={() => setReload((n) => n + 1)} className="btn btn-md btn-secondary">Try again</button>
        </div>
      )}
      {!isJira && <div className="mt-4"><Callout tone="info" icon="alert">Demo data. Real tickets, calendar and Google Tasks show up after sign-in.</Callout></div>}
      {flash && <div className="mt-4"><Callout tone={flash.tone} icon={flash.tone === "ok" ? "check" : "alert"}>{flash.text}</Callout></div>}

      {loading ? <p className="mt-6 text-sm text-muted">Loading…</p> : (
        <>
          <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_352px]">
          <div className="min-w-0">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 min-[1800px]:grid-cols-6">
            <Tile label="Open work" n={tiles.open.count} onClick={() => setTileOpen("open")} note="Tickets and tasks" />
            <Tile label="Due today" n={dueToday} onClick={() => setTileOpen("due")} note={bigSlot ? `Longest open stretch ${hm(minutes(bigSlot.end - bigSlot.start))}` : "No open stretch left"} />
            <Tile label="In progress" n={tiles.progress.count} onClick={() => setTileOpen("progress")} note="Being worked on" />
            <Tile label="Blocked" n={tiles.blocked.count} onClick={() => setTileOpen("blocked")} note="Waiting on someone" tone={tiles.blocked.count ? "bad" : undefined} />
            <Tile label="Overdue" n={overdue} onClick={() => setTileOpen("overdue")} note="Missed deadline" tone={overdue ? "bad" : undefined} />
            <Tile label="Completed" n={tiles.done.count} onClick={() => setTileOpen("done")} note="Last 14 days" />
          </div>

          {me?.role === "creative" && today && (
            <PlanWorkCard
              tickets={(projects ?? []).filter(needsStartDate)}
              today={today}
              onPlanned={(key, d) => setProjects((ps) => (ps ?? []).map((p) => (p.jiraKey === key ? { ...p, startDate: d } : p)))}
            />
          )}

          <div className="mt-4 grid gap-4 min-[1700px]:grid-cols-[2fr_1fr]">
            <Card
              title="Project timeline"
              action={
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShift(shift - 1)} aria-label="Earlier" className="flex h-7 w-7 items-center justify-center rounded-tight border border-control hover:bg-n-150"><span className="rotate-180"><Icon name="chevronRight" size={12} /></span></button>
                    <button onClick={() => setShift(0)} className="btn btn-sm btn-secondary">Today</button>
                    <button onClick={() => setShift(shift + 1)} aria-label="Later" className="flex h-7 w-7 items-center justify-center rounded-tight border border-control hover:bg-n-150"><Icon name="chevronRight" size={12} /></button>
                  </div>
                  <div className="seg" role="group" aria-label="Timeline length">
                    {WINDOWS.map((w) => <button key={w.id} onClick={() => { setWin(w.id); setShift(0); }} aria-pressed={win === w.id} className="seg-item">{w.label}</button>)}
                  </div>
                </div>
              }
            >
              {bars.length === 0 ? <p className="py-6 text-center text-sm text-muted">No tickets with dates in this window.</p> : <Gantt bars={shownBars} days={days} today={today!} start={winStart} />}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                {STATUS_META.filter((m) => m.key !== "tasks").map((m) => <span key={m.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-tight" style={{ background: m.color }} aria-hidden />{m.label}</span>)}
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-tight border-[1.5px] border-bad-fg" aria-hidden />Past deadline</span>
              </div>
              <MoreButton total={bars.length} shown={shownBars.length} expanded={showAllBars} onToggle={() => setShowAllBars(!showAllBars)} noun="tickets" limit={6} />
              {undated > 0 && <p className="mt-2 text-xs text-muted">{undated} {undated === 1 ? "ticket has" : "tickets have"} no deadline, so {undated === 1 ? "it isn't" : "they aren't"} on the timeline.</p>}
            </Card>

            <Card title="Task completion" hint="Tickets and tasks, finished vs open">
              <Gauge
                pct={comp.pct}
                caption={`${comp.done} of ${comp.total} completed`}
                parts={[
                  { key: "done", label: "Completed", color: "#08794a", count: comp.done },
                  { key: "progress", label: "In progress", color: "#348289", count: comp.progress },
                  { key: "todo", label: "To do", color: "#908d89", count: comp.todo },
                ]}
              />
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 flex items-baseline justify-between text-sm"><span className="font-bold">On-time score</span>{score && score.score !== null && <span className="text-xs text-muted">{score.onTime} on time · {score.late} late</span>}</div>
                <ScoreMeter score={score?.score ?? null} compact />
              </div>
            </Card>
          </div>

          <div className="mt-4">
            <Card
              title={tab === "priority" ? "Task priority" : "My tasks"}
              hint={tab === "priority" ? "Most urgent first" : "Private to you. Not added to Jira."}
              action={
                <div className="seg" role="tablist" aria-label="Task views">
                  {([["priority", "Priority"], ["tasks", `My tasks (${open.length})`]] as const).map(([id, label]) => (
                    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="seg-item">{label}</button>
                  ))}
                </div>
              }
            >
              {taskErr && <div className="mb-4"><Callout tone="bad" icon="alert">{taskErr}</Callout></div>}
              {syncErr && <div className="mb-4"><Callout tone="warn" icon="alert">Saved here, but Google Tasks backup is pending. {syncErr}</Callout></div>}
              {tab === "priority" ? (
                <>
                  {focus.length === 0 ? (
                    <p className="text-sm text-muted">Nothing is overdue or due soon. Pick something from <Link href="/projects" className="text-brand underline">Projects</Link>, or add a task.</p>
                  ) : (
                    <ol className="space-y-2">
                      {shownFocus.map((f) => <FocusRow key={`${f.kind}${f.id}`} f={f} today={today!} canPlan={me?.role === "creative"} onPlanned={(d) => setProjects((ps) => (ps ?? []).map((p) => (p.jiraKey === f.id ? { ...p, startDate: d } : p)))} slot={plan.find((p) => p.item.id === f.id)?.slot} planned={planned.has(f.id)} onDone={f.kind === "task" ? () => { celebrate(); void act(() => tasksRepo.update(f.id, { done: true })); } : undefined} />)}
                    </ol>
                  )}
                  <MoreButton total={focus.length} shown={shownFocus.length} expanded={showAllFocus} onToggle={() => setShowAllFocus(!showAllFocus)} noun="items" limit={4} />
                </>
              ) : (
                <>
                  {open.length === 0 ? <p className="text-sm text-muted">No open tasks.</p> : (
                    <ul className="space-y-2">
                      {shownTasks.map((t) => <TaskRow key={t.id} t={t} tz={tz} today={today} onToggle={() => { celebrate(); void act(() => tasksRepo.update(t.id, { done: true })); }} onDelete={() => act(() => tasksRepo.remove(t.id))} />)}
                    </ul>
                  )}
                  <MoreButton total={open.length} shown={shownTasks.length} expanded={showAllTasks} onToggle={() => setShowAllTasks(!showAllTasks)} noun="tasks" />
                  {done.length > 0 && (
                    <div className="mt-4">
                      <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="flex items-center gap-2 text-sm font-medium text-brand hover:underline">
                        <Icon name={showDone ? "chevronDown" : "chevronRight"} size={12} /> Completed ({done.length})
                      </button>
                      {showDone && (
                        <ul className="mt-2 space-y-2">
                          {done.map((t) => <TaskRow key={t.id} t={t} tz={tz} today={today} onToggle={() => act(() => tasksRepo.update(t.id, { done: false }))} onDelete={() => act(() => tasksRepo.remove(t.id))} />)}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
              {google?.connected && isJira && (
                <p className="mt-4 text-xs text-muted">
                  Google connected as {google.googleEmail}.{" "}
                  <button onClick={async () => { await googleRepo.disconnect(); setGoogle({ ...google, connected: false }); setEvents([]); }} className="font-medium text-brand underline">Disconnect</button>
                </p>
              )}
            </Card>

          </div>
          </div>

          <aside aria-label="Today" className="space-y-4 xl:sticky xl:top-4">
            <Card title="Reminders" hint={google?.connected ? "From Google Calendar and your timed tasks" : undefined}>
              {google && !google.connected && isJira && (
                <div className="mb-4 flex flex-wrap items-center gap-4 rounded-tight border border-dashed border-control p-4 text-sm">
                  <Icon name="calendar" size={18} />
                  <span className="min-w-0 flex-1">{google.configured ? "Connect Google to plan around your meetings and back up tasks." : "Google isn't set up for this app yet."}</span>
                  {google.configured && <a href="/api/google/connect" className="btn btn-md btn-primary">Connect Google</a>}
                </div>
              )}
              {google?.broken || eventsErr?.code === "reconnect" ? (
                <div className="mb-4"><Callout tone="warn" icon="alert">Google needs to be reconnected. <a className="underline" href="/api/google/connect">Reconnect</a></Callout></div>
              ) : eventsErr && eventsErr.code !== "not-connected" && eventsErr.code !== "not-configured" ? (
                <div className="mb-4"><Callout tone="bad" icon="alert">{eventsErr.message}</Callout></div>
              ) : null}
              {next && (
                <div className="mb-4 rounded-loose border border-line p-4">
                  <p className="text-muted eyebrow">Next up</p>
                  <p className="mt-2 font-bold">{next.label}</p>
                  <p className="text-sm text-muted">Today, {clock(next.at)} – {clock(next.end!)}{next.at <= now ? " (happening now)" : ""}</p>
                  {next.link && <a href={next.link} target="_blank" rel="noreferrer" className="btn btn-md btn-primary mt-4">Open meeting</a>}
                </div>
              )}
              {schedule.length === 0 ? (
                <p className="text-sm text-muted">{google?.connected ? "Nothing on your calendar today." : "No timed items today."}</p>
              ) : shownSchedule.length === 0 && !next ? (
                <p className="text-sm text-muted">Everything on today&apos;s calendar is finished.</p>
              ) : (
                <ul className="space-y-2">
                  {shownSchedule.map((r, i) => {
                    const past = !r.allDay && (r.end ?? r.at) < now;
                    return (
                      <li key={i} className={`flex items-center gap-2 rounded-tight border border-line px-4 py-2 text-sm ${past ? "opacity-55" : ""}`}>
                        <span className="w-[4.75rem] shrink-0 text-xs tabular-nums text-muted">{r.allDay ? "All day" : clock(r.at)}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                        <Tag tone={r.kind === "meeting" ? "info" : "progress"}>{r.kind === "meeting" ? "Meeting" : "Task"}</Tag>
                      </li>
                    );
                  })}
                </ul>
              )}
              <MoreButton total={schedule.length - (next ? 1 : 0)} shown={shownSchedule.length} expanded={showAllSchedule} onToggle={() => setShowAllSchedule(!showAllSchedule)} noun="events" limit={3} />
            </Card>

            <Card title="Recent activity" hint="Latest change on tickets you're on">
              {activity === null ? <p className="text-sm text-muted">Loading…</p> : activity.length === 0 ? <p className="text-sm text-muted">No recent changes.</p> : (
                <ul className="space-y-2">
                  {activity.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-start gap-4 rounded-tight border border-line p-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-round bg-n-150 text-xs font-bold" aria-hidden>{a.who.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p><b>{a.mine ? "You" : a.who}</b> {a.what}</p>
                        <p className="truncate"><Link href={`/projects/${a.key}`} className="text-muted hover:underline">{a.key} · {a.title}</Link></p>
                        <p className="text-xs text-muted">{relativeTime(a.at, now)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>
        </>
      )}
      {tileOpen && today && <TileDialog kind={tileOpen} items={tiles[tileOpen].items} tz={tz} today={today} onClose={() => setTileOpen(null)} onDone={(t) => { celebrate(); void act(() => tasksRepo.update(t.id, { done: true })); }} />}
      {adding && <AddTaskDialog onClose={() => setAdding(false)} onAdd={async (d) => { await act(() => tasksRepo.add(d)); setAdding(false); setTab("tasks"); }} />}
    </main>
  );
}

function Card({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-[1_1_10rem]">
          <h2 className="text-base font-bold">{title}</h2>
          {hint && <p className="mt-0 text-xs text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, n, note, tone, onClick }: { label: string; n: number; note: string; tone?: "bad"; onClick?: () => void }) {
  const Wrap = onClick ? "button" : "div";
  return (
    <Wrap
      {...(onClick ? { onClick, type: "button" as const, "aria-haspopup": "dialog" as const, title: "See the list" } : {})}
      className={`flex h-full flex-col items-start card p-4 text-left ${onClick ? "card-hover cursor-pointer focus-visible:outline-offset-2" : ""}`}
    >
      <div className="text-sm font-bold">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-3xl font-bold tabular-nums ${tone === "bad" ? "text-bad-fg" : ""}`}>{n}</span>
        {tone === "bad" && n > 0 && <Tag tone="bad" icon="alert">Attention</Tag>}
      </div>
      <div className="mt-2 text-xs text-muted">{note}</div>
      {onClick && <div className="mt-2 flex items-center gap-2 text-xs font-medium text-brand">See the list <Icon name="chevronRight" size={12} /></div>}
    </Wrap>
  );
}

const TILE_COPY: Record<TileKind, { title: string; empty: string }> = {
  open: { title: "Open work", empty: "No open tickets or tasks." },
  due: { title: "Due today", empty: "Nothing is due today." },
  progress: { title: "In progress", empty: "Nothing is in progress." },
  blocked: { title: "Blocked", empty: "Nothing is blocked." },
  overdue: { title: "Overdue", empty: "Nothing is overdue. Nice." },
  done: { title: "Completed in the last 14 days", empty: "Nothing finished in the last 14 days yet." },
};

/** A summary of the tickets and tasks behind one of the tiles at the top of My Day. */
function TileDialog({ kind, items, tz, today, onClose, onDone }: { kind: TileKind; items: { tickets: Project[]; tasks: PersonalTask[] }; tz: string; today: string; onClose: () => void; onDone: (t: PersonalTask) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const total = items.tickets.length + items.tasks.length;
  const copy = TILE_COPY[kind];
  const day = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const when = (p: Project) => {
    if (kind === "done") return p.resolvedAt ? <span>Closed {new Date(`${p.resolvedAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : null;
    const late = pastDueDays(p, today);
    if (late !== null) return <span className="font-bold text-bad-fg">Past due · {pastDueWords(late)}</span>;
    return p.deadline ? <span>Due {new Date(`${p.deadline}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : <span>No deadline</span>;
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={copy.title} onMouseDown={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-loose border border-line bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{copy.title}</h2>
            <p className="text-sm text-muted">{day} · {plural(total, "item", "items")} ({plural(items.tickets.length, "Jira ticket", "Jira tickets")}, {plural(items.tasks.length, "task", "tasks")})</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-tight hover:bg-n-150"><Icon name="x" size={16} /></button>
        </div>
        {total === 0 ? (
          <p className="mt-4 rounded-tight border border-dashed border-control p-4 text-center text-sm text-muted">{copy.empty}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {items.tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 rounded-tight border border-line px-4 py-2 text-sm">
                {kind === "done"
                  ? <span className="mt-0 text-ok-fg" aria-label="Done"><Icon name="check" size={16} /></span>
                  : <input type="checkbox" checked={false} onChange={() => onDone(t)} aria-label={`Mark "${t.title}" done`} className="mt-2 h-4 w-4 shrink-0 accent-brand" />}
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${kind === "done" ? "text-muted line-through" : ""}`}>{t.title}</div>
                  <div className="mt-0 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Tag tone="progress" icon="task">My task</Tag>
                    <span className={kind === "overdue" ? "font-bold text-bad-fg" : ""}>{dueText(t, tz)}</span>
                    <BackupTag t={t} />
                  </div>
                </div>
              </li>
            ))}
            {items.tickets.map((p) => (
              <li key={p.jiraKey} className="flex items-start gap-2 rounded-tight border border-line px-4 py-2 text-sm">
                <span className="mt-0"><IssueIcon level={p.issueType?.level ?? 0} typeName={p.issueType?.name} /></span>
                <div className="min-w-0 flex-1">
                  <Link href={`/projects/${p.jiraKey}`} className="font-medium hover:underline">{p.title}</Link>
                  <div className="mt-0 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Tag tone="info" icon="ticket">Jira ticket</Tag>
                    <span>{p.jiraKey}</span>
                    <StatusTag project={p} />
                    {when(p)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MoreButton({ total, shown, expanded, onToggle, noun, limit = 5 }: { total: number; shown: number; expanded: boolean; onToggle: () => void; noun: string; limit?: number }) {
  if (total <= limit && !expanded) return null;
  return (
    <button onClick={onToggle} aria-expanded={expanded} className="mt-4 flex items-center gap-2 text-sm font-medium text-brand hover:underline">
      <Icon name={expanded ? "chevronDown" : "chevronRight"} size={12} />
      {expanded ? "Show fewer" : `View ${total - shown} more ${total - shown === 1 ? noun.replace(/s$/, "") : noun}`}
    </button>
  );
}

function AddTaskDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (d: { title: string; date?: string; time?: string; tz?: string }) => Promise<void> }) {
  const [d, setD] = useState({ title: "", date: "", time: "", tz: localTimezone() });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return;
    setBusy(true);
    await onAdd({ title: d.title, date: d.date || undefined, time: d.date && d.time ? d.time : undefined, tz: d.date && d.time ? d.tz : undefined });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onClose}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Add a task" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-loose border border-line bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">Add a task</h2>
        <p className="text-sm text-muted">Private to you. It shows on your calendar and is backed up to Google Tasks, never added to Jira.</p>
        <label className="block text-sm font-bold">Task
          <input autoFocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={200} placeholder="e.g. Send exports to Riley" className={`${field} mt-2 w-full font-normal`} />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-bold">Due date<div className="mt-2 w-48"><DatePicker value={d.date} onChange={(v) => setD({ ...d, date: v, time: v ? d.time : "" })} placeholder="No date" /></div></label>
          <label className="text-sm font-bold">Time<input type="time" value={d.time} disabled={!d.date} onChange={(e) => setD({ ...d, time: e.target.value })} className={`${field} mt-2 block font-normal disabled:opacity-40`} /></label>
        </div>
        {d.time && (
          <label className="block text-sm font-bold">Time zone
            <select value={d.tz} onChange={(e) => setD({ ...d, tz: e.target.value })} className={`${field} mt-2 block w-full font-normal`}>
              {timezoneOptions(d.tz).map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </label>
        )}
        <div className="flex gap-2">
          <button disabled={busy || !d.title.trim()} className="btn btn-md btn-primary">{busy ? "Adding…" : "Add task"}</button>
          <button type="button" onClick={onClose} className="btn btn-md btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function FocusRow({ f, today, slot, planned, onDone, canPlan, onPlanned }: { f: FocusItem; today: string; slot?: { start: number; end: number }; planned: boolean; onDone?: () => void; canPlan: boolean; onPlanned: (date: string) => void }) {
  const hot = f.reason.startsWith("Overdue");
  const stageIdx = f.kind === "ticket" ? STAGES_ORDER.indexOf(f.project.stage) + 1 : 0;
  return (
    <li className="rounded-tight border border-line px-4 py-2">
      <div className="flex items-start gap-2">
        {onDone
          ? <input type="checkbox" checked={false} onChange={onDone} aria-label={`Mark "${f.title}" done`} className="mt-2 h-4 w-4 shrink-0 accent-brand" />
          : <span className="mt-0 shrink-0"><IssueIcon level={f.kind === "ticket" ? f.project.issueType?.level ?? 0 : 0} typeName={f.kind === "ticket" ? f.project.issueType?.name : undefined} size={18} /></span>}
        <div className="min-w-0 flex-1">
          {f.kind === "ticket"
            ? <Link href={`/projects/${f.key}`} className="font-bold hover:underline">{f.title}</Link>
            : <span className="font-bold">{f.title}</span>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag tone={hot ? "bad" : f.reason.includes("Blocked") ? "warn" : "info"}>{f.reason}</Tag>
            {f.kind === "ticket" && needsStartDate(f.project) && <NoStartTag />}
            {f.kind === "ticket" ? <span className="text-xs text-muted">{f.key} · {f.project.statusName ?? f.project.stage}{f.project.statusName ? "" : ` (${stageIdx}/${STAGES_ORDER.length})`}</span> : <Tag tone="progress">Task</Tag>}
          </div>
          {f.kind === "ticket" && <div className="mt-2"><TimelineMeter t={timeline(f.project, today)} label={`Time used on ${f.title}`} /></div>}
          {planned && slot && <p className="mt-2 text-xs text-muted">Suggested: {clock(slot.start)} – {clock(Math.min(slot.end, slot.start + 90 * 6e4))} ({hm(Math.min(90, minutes(slot.end - slot.start)))})</p>}
        </div>
        {f.kind === "ticket" && canPlan && needsStartDate(f.project) && <div className="shrink-0"><PlanWork project={f.project} onPlanned={onPlanned} /></div>}
      </div>
    </li>
  );
}

function TaskRow({ t, tz, today, onToggle, onDelete }: { t: PersonalTask; tz: string; today: string | null; onToggle: () => void; onDelete: () => void }) {
  const overdue = !t.done && !!t.date && !!today && t.date < today;
  return (
    <li className="flex items-start gap-2 rounded-tight border border-line px-4 py-2 text-sm">
      <input type="checkbox" checked={t.done} onChange={onToggle} aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`} className="mt-2 h-4 w-4 accent-brand" />
      <div className="min-w-0 flex-1">
        <div className={`font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</div>
        <div className="mt-0 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className={overdue ? "font-bold text-bad-fg" : ""}>{dueText(t, tz)}</span>
          <BackupTag t={t} />
        </div>
      </div>
      <button onClick={onDelete} aria-label={`Delete "${t.title}"`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-tight hover:bg-n-150"><Icon name="x" size={14} /></button>
    </li>
  );
}
