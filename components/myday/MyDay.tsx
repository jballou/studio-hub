"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { googleRepo, GoogleUnavailable, isJira, projectsRepo, tasksRepo, type GoogleStatus } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import { focusList, headline, hm, localDay, minutes, onTimeScore, openSlots, statusBreakdown, suggest, taskInstant, timeline, STAGES_ORDER, type DayEvent, type FocusItem } from "@/lib/myday/plan";
import { Donut, ScoreMeter, TimelineMeter } from "./Charts";
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
const field = "rounded-lg border border-control bg-white px-3 py-2 text-sm";

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

export function MyDay() {
  const me = useMe();
  const flashKey = useSearchParams().get("google");
  const [today, setToday] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [tz] = useState(localTimezone);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<PersonalTask[] | null>(null);
  const [events, setEvents] = useState<DayEvent[] | null>(null);
  const [eventsErr, setEventsErr] = useState<{ message: string; code?: string } | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [taskErr, setTaskErr] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", date: "", time: "", tz: "" });
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showAllFocus, setShowAllFocus] = useState(false);
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    // The date is read in the browser so "today" is the person's own day, not the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    setNow(Date.now());
    setDraft((d) => ({ ...d, tz: localTimezone() }));
  }, []);

  const applyTasks = useCallback((s: { tasks: PersonalTask[]; syncError?: string }) => { setTasks(s.tasks); setSyncErr(s.syncError ?? null); }, []);

  useEffect(() => {
    if (!me || !today) return;
    let live = true;
    projectsRepo.myWork(me.id).then((p) => live && setProjects(p)).catch(() => live && setProjects([]));
    tasksRepo.list().then((s) => live && applyTasks(s)).catch((e) => { if (live) { setTasks([]); setTaskErr(e.message); } });
    googleRepo.status().then((s) => live && setGoogle(s)).catch(() => live && setGoogle({ configured: false, connected: false }));
    const start = new Date(`${today}T00:00:00`), end = new Date(`${today}T23:59:59`);
    googleRepo.events(start.toISOString(), end.toISOString())
      .then((e) => { if (live) { setEvents(e); setEventsErr(null); } })
      .catch((e) => { if (live) { setEvents([]); setEventsErr({ message: e.message, code: e instanceof GoogleUnavailable ? e.code : undefined }); } });
    return () => { live = false; };
  }, [me, today, applyTasks]);

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

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    await act(() => tasksRepo.add({ title: draft.title, date: draft.date || undefined, time: draft.date && draft.time ? draft.time : undefined, tz: draft.date && draft.time ? draft.tz : undefined }));
    setDraft((d) => ({ ...d, title: "", date: "", time: "" }));
    setBusy(false);
  };

  const flash = flashKey ? FLASH[flashKey] : null;
  const open = (tasks ?? []).filter((t) => !t.done).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? ""));
  const done = (tasks ?? []).filter((t) => t.done);
  const loading = !today || projects === null || tasks === null || events === null;
  const dateLabel = today ? new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";

  const score = useMemo(() => (today && projects ? onTimeScore(projects, tasks ?? [], today) : null), [projects, tasks, today]);
  const slices = useMemo(() => statusBreakdown(projects ?? [], tasks ?? []), [projects, tasks]);
  const overdue = focus.filter((f) => f.reason.startsWith("Overdue")).length;
  const dueToday = focus.filter((f) => f.reason.startsWith("Due today")).length;
  const meetingMs = (events ?? []).filter((e) => !e.allDay).reduce((n, e) => n + (+new Date(e.end) - +new Date(e.start)), 0);
  const bigSlot = [...slots].sort((a, b) => b.end - b.start - (a.end - a.start))[0];

  // Upcoming and in-progress meetings first; finished ones sit behind "View all".
  const upcoming = schedule.filter((r) => r.allDay || (r.end ?? r.at) >= now);
  const shownSchedule = showAllSchedule ? schedule : upcoming.slice(0, 4);
  const shownFocus = showAllFocus ? focus : focus.slice(0, 5);
  const shownTasks = showAllTasks ? open : open.slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-2xl font-bold">My Day</h1>
        <p className="text-sm text-muted">{dateLabel}</p>
      </div>
      {!isJira && <div className="mt-3"><Callout tone="info" icon="alert">Demo data. Real tickets, calendar and Google Tasks show up after sign-in.</Callout></div>}
      {flash && <div className="mt-3"><Callout tone={flash.tone} icon={flash.tone === "ok" ? "check" : "alert"}>{flash.text}</Callout></div>}

      {loading ? <p className="mt-6 text-sm text-muted">Loading…</p> : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card title="On-time score" hint="Open and finished work with a deadline">
              <ScoreMeter score={score?.score ?? null} />
              {score && score.score !== null && (
                <p className="mt-2 text-sm text-muted"><b className="text-ink">{score.onTime}</b> on time · <b className={score.late ? "text-bad-fg" : "text-ink"}>{score.late}</b> late</p>
              )}
            </Card>
            <Card title="Status" hint="Your open tickets and tasks">
              <Donut slices={slices} centerLabel="open" />
            </Card>
            <Card title="Today" hint={headline(events ?? [], focus, today!, slots)}>
              <div className="grid grid-cols-2 gap-3">
                <Stat n={overdue} label="Overdue" tone={overdue ? "bad" : undefined} />
                <Stat n={dueToday} label="Due today" />
                <Stat n={(events ?? []).filter((e) => !e.allDay).length} label={`Meetings (${hm(minutes(meetingMs))})`} />
                <Stat n={bigSlot ? hm(minutes(bigSlot.end - bigSlot.start)) : "None"} label="Longest open stretch" />
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card title="Work on today" hint={`${focus.length} item${focus.length === 1 ? "" : "s"}, most urgent first`}>
              {focus.length === 0 ? (
                <p className="text-sm text-muted">Nothing is overdue or due soon. Pick something from <Link href="/projects" className="text-brand underline">Projects</Link>, or add a task.</p>
              ) : (
                <ol className="space-y-2">
                  {shownFocus.map((f, i) => <FocusRow key={`${f.kind}${f.id}`} f={f} n={i + 1} today={today!} slot={plan.find((p) => p.item.id === f.id)?.slot} planned={planned.has(f.id)} />)}
                </ol>
              )}
              <MoreButton total={focus.length} shown={shownFocus.length} expanded={showAllFocus} onToggle={() => setShowAllFocus(!showAllFocus)} noun="items" />
            </Card>

            <div className="space-y-4">
              <Card title="Today's schedule" hint={google?.connected ? "Google Calendar and timed tasks" : undefined}>
                {google && !google.connected && isJira && (
                  <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-control p-3 text-sm">
                    <Icon name="calendar" size={18} />
                    <span className="min-w-0 flex-1">{google.configured ? "Connect Google to plan around your meetings and back up tasks." : "Google isn't set up for this app yet."}</span>
                    {google.configured && <a href="/api/google/connect" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-n-50 hover:bg-brand-dark">Connect Google</a>}
                  </div>
                )}
                {google?.broken || eventsErr?.code === "reconnect" ? (
                  <div className="mb-3"><Callout tone="warn" icon="alert">Google needs to be reconnected. <a className="underline" href="/api/google/connect">Reconnect</a></Callout></div>
                ) : eventsErr && eventsErr.code !== "not-connected" && eventsErr.code !== "not-configured" ? (
                  <div className="mb-3"><Callout tone="bad" icon="alert">{eventsErr.message}</Callout></div>
                ) : null}
                {schedule.length === 0 ? (
                  <p className="text-sm text-muted">{google?.connected ? "Nothing on your calendar today." : "No timed items today."}</p>
                ) : shownSchedule.length === 0 ? (
                  <p className="text-sm text-muted">Everything on today&apos;s calendar is finished.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {shownSchedule.map((r, i) => {
                      const past = !r.allDay && (r.end ?? r.at) < now;
                      return (
                        <li key={i} className={`flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm ${past ? "opacity-55" : ""}`}>
                          <span className="w-[5.5rem] shrink-0 text-xs tabular-nums text-muted">{r.allDay ? "All day" : clock(r.at)}</span>
                          <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                          <Tag tone={r.kind === "meeting" ? "info" : "progress"}>{r.kind === "meeting" ? "Meeting" : "Task"}</Tag>
                          {r.link && <a href={r.link} target="_blank" rel="noreferrer" aria-label={`Open ${r.label}`} className="text-brand underline">Open</a>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <MoreButton total={schedule.length} shown={shownSchedule.length} expanded={showAllSchedule} onToggle={() => setShowAllSchedule(!showAllSchedule)} noun="events" limit={4} />
              </Card>

              <Card title="My tasks" hint="Private to you. Not added to Jira.">
                <form onSubmit={add} className="mb-4 space-y-2">
                  <label className="sr-only" htmlFor="task-title">Task</label>
                  <input id="task-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Add a task" maxLength={200} className={`${field} w-full`} />
                  <div className="flex flex-wrap gap-2">
                    <label className="text-xs font-semibold">Due date<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value, time: e.target.value ? draft.time : "" })} className={`${field} mt-1 block font-normal`} /></label>
                    <label className="text-xs font-semibold">Time<input type="time" value={draft.time} disabled={!draft.date} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className={`${field} mt-1 block font-normal disabled:opacity-40`} /></label>
                    {draft.time && (
                      <label className="min-w-0 flex-1 text-xs font-semibold">Time zone
                        <select value={draft.tz} onChange={(e) => setDraft({ ...draft, tz: e.target.value })} className={`${field} mt-1 block w-full font-normal`}>
                          {timezoneOptions(draft.tz).map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                  <button disabled={busy || !draft.title.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">{busy ? "Adding…" : "Add task"}</button>
                </form>
                {taskErr && <div className="mb-3"><Callout tone="bad" icon="alert">{taskErr}</Callout></div>}
                {syncErr && <div className="mb-3"><Callout tone="warn" icon="alert">Saved here, but Google Tasks backup is pending. {syncErr}</Callout></div>}
                {open.length === 0 ? <p className="text-sm text-muted">No open tasks.</p> : (
                  <ul className="space-y-1.5">
                    {shownTasks.map((t) => <TaskRow key={t.id} t={t} tz={tz} today={today} onToggle={() => act(() => tasksRepo.update(t.id, { done: true }))} onDelete={() => act(() => tasksRepo.remove(t.id))} />)}
                  </ul>
                )}
                <MoreButton total={open.length} shown={shownTasks.length} expanded={showAllTasks} onToggle={() => setShowAllTasks(!showAllTasks)} noun="tasks" />
                {done.length > 0 && (
                  <div className="mt-3">
                    <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                      <Icon name={showDone ? "chevronDown" : "chevronRight"} size={12} /> Completed ({done.length})
                    </button>
                    {showDone && (
                      <ul className="mt-2 space-y-1.5">
                        {done.map((t) => <TaskRow key={t.id} t={t} tz={tz} today={today} onToggle={() => act(() => tasksRepo.update(t.id, { done: false }))} onDelete={() => act(() => tasksRepo.remove(t.id))} />)}
                      </ul>
                    )}
                  </div>
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
        </>
      )}
    </main>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <h2 className="text-base font-bold">{title}</h2>
      {hint ? <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function Stat({ n, label, tone }: { n: number | string; label: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg bg-n-100 px-3 py-2">
      <div className={`text-2xl font-bold tabular-nums ${tone === "bad" ? "text-bad-fg" : ""}`}>{n}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function MoreButton({ total, shown, expanded, onToggle, noun, limit = 5 }: { total: number; shown: number; expanded: boolean; onToggle: () => void; noun: string; limit?: number }) {
  if (total <= limit && !expanded) return null;
  return (
    <button onClick={onToggle} aria-expanded={expanded} className="mt-3 flex items-center gap-1 text-sm font-medium text-brand hover:underline">
      <Icon name={expanded ? "chevronDown" : "chevronRight"} size={12} />
      {expanded ? "Show fewer" : `View ${total - shown} more ${total - shown === 1 ? noun.replace(/s$/, "") : noun}`}
    </button>
  );
}

function FocusRow({ f, n, today, slot, planned }: { f: FocusItem; n: number; today: string; slot?: { start: number; end: number }; planned: boolean }) {
  const hot = f.reason.startsWith("Overdue");
  const stageIdx = f.kind === "ticket" ? STAGES_ORDER.indexOf(f.project.stage) + 1 : 0;
  return (
    <li className="rounded-lg border border-line px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-n-150 text-xs font-bold" aria-hidden>{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {f.kind === "ticket" ? <Tag tone="neutral">{f.key}</Tag> : <Tag tone="progress">Task</Tag>}
            {f.kind === "ticket"
              ? <Link href={`/projects/${f.key}`} className="font-semibold hover:underline">{f.title}</Link>
              : <span className="font-semibold">{f.title}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <Tag tone={hot ? "bad" : f.reason.includes("Blocked") ? "warn" : "info"}>{f.reason}</Tag>
            {f.kind === "ticket" && <span className="text-xs text-muted">{f.project.type} · {f.project.stage} (step {stageIdx} of {STAGES_ORDER.length}){f.project.requesterName ? ` · from ${f.project.requesterName}` : ""}</span>}
            {f.kind === "task" && f.task.notes && <span className="truncate text-xs text-muted">{f.task.notes}</span>}
          </div>
          {f.kind === "ticket" && <div className="mt-2"><TimelineMeter t={timeline(f.project, today)} label={`Time used on ${f.title}`} /></div>}
          {planned && slot && <p className="mt-2 text-xs text-muted">Suggested: {clock(slot.start)} – {clock(Math.min(slot.end, slot.start + 90 * 6e4))} ({hm(Math.min(90, minutes(slot.end - slot.start)))})</p>}
        </div>
      </div>
    </li>
  );
}

function TaskRow({ t, tz, today, onToggle, onDelete }: { t: PersonalTask; tz: string; today: string | null; onToggle: () => void; onDelete: () => void }) {
  const overdue = !t.done && !!t.date && !!today && t.date < today;
  return (
    <li className="flex items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm">
      <input type="checkbox" checked={t.done} onChange={onToggle} aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`} className="mt-1 h-4 w-4 accent-brand" />
      <div className="min-w-0 flex-1">
        <div className={`font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className={overdue ? "font-semibold text-bad-fg" : ""}>{dueText(t, tz)}</span>
          <BackupTag t={t} />
        </div>
      </div>
      <button onClick={onDelete} aria-label={`Delete "${t.title}"`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-n-150"><Icon name="x" size={14} /></button>
    </li>
  );
}
