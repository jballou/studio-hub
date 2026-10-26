"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { googleRepo, GoogleUnavailable, isJira, projectsRepo, tasksRepo, type GoogleStatus } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import { focusList, headline, hm, localDay, minutes, openSlots, suggest, taskInstant, type DayEvent, type FocusItem } from "@/lib/myday/plan";
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

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

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="text-2xl font-bold">My Day</h1>
      <p className="mt-1 text-sm text-muted">{dateLabel}</p>
      {!isJira && <div className="mt-3"><Callout tone="info" icon="alert">Demo data. Real tickets, calendar and Google Tasks show up after sign-in.</Callout></div>}
      {flash && <div className="mt-3"><Callout tone={flash.tone} icon={flash.tone === "ok" ? "check" : "alert"}>{flash.text}</Callout></div>}

      {!loading && <p className="mt-4 rounded-xl border border-line bg-brand-soft px-4 py-3 text-base font-medium">{headline(events ?? [], focus, today!, slots)}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Section title="Work on today" hint="From your open Jira tickets and tasks">
            {loading ? <p className="text-sm text-muted">Loading…</p> : focus.length === 0 ? (
              <p className="text-sm text-muted">Nothing is overdue or due soon. Pick something from <Link href="/projects" className="text-brand underline">Projects</Link>, or add a task.</p>
            ) : (
              <ol className="space-y-2">
                {focus.map((f, i) => <FocusRow key={`${f.kind}${f.id}`} f={f} n={i + 1} slot={plan.find((p) => p.item.id === f.id)?.slot} planned={planned.has(f.id)} />)}
              </ol>
            )}
          </Section>

          <Section title="Today's schedule" hint={google?.connected ? "From Google Calendar and your timed tasks" : undefined}>
            {google && !google.connected && isJira && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-control p-3 text-sm">
                <Icon name="calendar" size={18} />
                <span className="min-w-0 flex-1">{google.configured ? "Connect Google to plan around your meetings and back up your tasks to Google Tasks." : "Google isn't set up for this app yet. An admin needs to add the Google client credentials."}</span>
                {google.configured && <a href="/api/google/connect" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-n-50 hover:bg-brand-dark">Connect Google</a>}
              </div>
            )}
            {google?.broken || eventsErr?.code === "reconnect" ? (
              <div className="mb-3"><Callout tone="warn" icon="alert">Google needs to be reconnected. <a className="underline" href="/api/google/connect">Reconnect</a></Callout></div>
            ) : eventsErr && eventsErr.code !== "not-connected" && eventsErr.code !== "not-configured" ? (
              <div className="mb-3"><Callout tone="bad" icon="alert">{eventsErr.message}</Callout></div>
            ) : null}
            {loading ? <p className="text-sm text-muted">Loading…</p> : schedule.length === 0 ? (
              <p className="text-sm text-muted">{google?.connected ? "Nothing on your calendar today." : "No timed items today."}</p>
            ) : (
              <ul className="space-y-1.5">
                {schedule.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                    <span className="w-28 shrink-0 tabular-nums text-muted">{r.allDay ? "All day" : r.end ? `${clock(r.at)} – ${clock(r.end)}` : clock(r.at)}</span>
                    <Tag tone={r.kind === "meeting" ? "info" : "progress"}>{r.kind === "meeting" ? "Meeting" : "Task"}</Tag>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                    {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="text-brand underline">Open</a>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="My tasks" hint="Private to you. Not added to Jira.">
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
          {google && !google.connected && isJira && google.configured && (tasks?.length ?? 0) > 0 && <p className="mb-3 text-xs text-muted">Connect Google (above) to back these up to a &ldquo;Brand Creative Hub&rdquo; list in Google Tasks.</p>}
          {tasks === null ? <p className="text-sm text-muted">Loading…</p> : open.length === 0 ? <p className="text-sm text-muted">No open tasks.</p> : (
            <ul className="space-y-1.5">
              {open.map((t) => <TaskRow key={t.id} t={t} tz={tz} today={today} onToggle={() => act(() => tasksRepo.update(t.id, { done: true }))} onDelete={() => act(() => tasksRepo.remove(t.id))} />)}
            </ul>
          )}
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
        </Section>
      </div>
    </main>
  );
}

function FocusRow({ f, n, slot, planned }: { f: FocusItem; n: number; slot?: { start: number; end: number }; planned: boolean }) {
  const href = f.kind === "ticket" ? `/projects/${f.key}` : undefined;
  const hot = f.reason.startsWith("Overdue");
  return (
    <li className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-n-150 text-xs font-bold" aria-hidden>{n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {f.kind === "ticket" && <Tag tone="neutral">{f.key}</Tag>}
          {f.kind === "task" && <Tag tone="progress">Task</Tag>}
          {href ? <Link href={href} className="font-semibold hover:underline">{f.title}</Link> : <span className="font-semibold">{f.title}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <Tag tone={hot ? "bad" : f.reason.includes("Blocked") ? "warn" : "info"}>{f.reason}</Tag>
          {planned && slot && <span className="text-muted">Suggested: {clock(slot.start)} – {clock(Math.min(slot.end, slot.start + 90 * 6e4))} ({hm(Math.min(90, minutes(slot.end - slot.start)))})</span>}
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
