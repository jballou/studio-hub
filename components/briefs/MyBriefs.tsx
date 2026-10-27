"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { Callout, StatusTag, Tag } from "@/components/ui/Tag";
import { Logo } from "@/components/ui/Logo";
import { StaleNotice } from "@/components/ui/StaleNotice";
import { isJira, projectsRepo, repo } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import { BRIEF_STEPS, excerpt, matchesFilter, needsInput, sortBriefs, stepIndex, summarize, type BriefFilter } from "@/lib/briefs";
import { daysBetween, localDay } from "@/lib/myday/plan";
import { pastDueDays, pastDueWords } from "@/lib/pastdue";
import type { Project, User } from "@/lib/types";

const JIRA_BASE = "https://surveymonkey.atlassian.net";
const FILTERS: { id: BriefFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "active", label: "In progress" }, { id: "input", label: "Needs your input" }, { id: "delivered", label: "Delivered" },
];

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Stepper({ p }: { p: Project }) {
  const at = stepIndex(p);
  return (
    <ol className="flex items-center" aria-label={`Progress: step ${at + 1} of ${BRIEF_STEPS.length}, ${BRIEF_STEPS[at]}`}>
      {BRIEF_STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none" aria-current={i === at ? "step" : undefined}>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${i < at || p.group === "closed" ? "border-brand bg-brand text-n-50" : i === at ? "border-brand bg-white text-brand" : "border-n-200 bg-white text-n-650"}`} title={s}>
            {i < at || p.group === "closed" ? <Icon name="check" size={11} /> : i + 1}
          </span>
          {i < BRIEF_STEPS.length - 1 && <span className={`h-0.5 flex-1 ${i < at ? "bg-brand" : "bg-n-200"}`} />}
        </li>
      ))}
    </ol>
  );
}

function BriefCard({ p, today, people }: { p: Project; today: string; people: Map<string, string> }) {
  const late = pastDueDays(p, today);
  const left = p.deadline && p.group !== "closed" && late === null ? daysBetween(today, p.deadline) : null;
  const input = needsInput(p);
  const who = p.collaboratorNames?.[0] ?? people.get(p.collaboratorIds[0] ?? "");
  const text = excerpt(p);
  return (
    <li className={`group relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${input ? "border-warn-line" : late !== null ? "border-bad-line" : "border-line"}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <IssueIcon level={p.issueType?.level ?? 0} typeName={p.issueType?.name} size={18} />
        <span className="text-xs font-medium text-muted">{p.issueType?.name ?? p.type}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {p.viaHub ? <Tag tone="ok" icon="check">Made in the Hub</Tag> : <Tag tone="neutral" icon="ticket">From Jira</Tag>}
        </span>
      </div>

      <h2 className="text-lg font-bold leading-snug">
        <Link href={`/projects/${p.jiraKey}`} className="after:absolute after:inset-0 after:content-[''] hover:underline">{p.title}</Link>
      </h2>
      <p className="mt-0.5 font-mono text-xs text-muted">{p.jiraKey}</p>
      {text && <p className="mt-2 line-clamp-2 text-sm text-n-800">{text}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusTag project={p} />
        {input && <Tag tone="warn" icon="alert">{p.flag === "needs-info" ? "More info needed" : "Your feedback is needed"}</Tag>}
        {late !== null && <Tag tone="bad" icon="alert">Past due · {pastDueWords(late)}</Tag>}
        {p.flag === "blocked" && <Tag tone="bad" icon="block">Blocked</Tag>}
      </div>

      <div className="mt-4"><Stepper p={p} /></div>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{BRIEF_STEPS[0]}</span><span>{BRIEF_STEPS[BRIEF_STEPS.length - 1]}</span></div>

      <div className="mt-4 flex items-center gap-3 border-t border-line pt-3 text-sm">
        {who ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-n-150 text-[11px] font-bold" aria-hidden>{who.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            <span className="truncate text-muted">With <b className="font-semibold text-ink">{who}</b></span>
          </span>
        ) : <span className="text-muted">Waiting to be picked up</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
          <Icon name="calendar" size={13} />
          {p.group === "closed" ? <span className="text-muted">{p.resolvedAt ? `Delivered ${dayLabel(p.resolvedAt)}` : "Delivered"}</span>
            : late !== null ? <span className="font-semibold text-bad-fg">Was due {dayLabel(p.deadline)}</span>
            : left !== null ? <span className={left <= 2 ? "font-semibold text-warn-fg" : "text-muted"}>{left === 0 ? "Due today" : left === 1 ? "Due tomorrow" : `Due ${dayLabel(p.deadline)} · ${left} days`}</span>
            : <span className="text-muted">No deadline</span>}
        </span>
      </div>

      {isJira && <a href={`${JIRA_BASE}/browse/${p.jiraKey}`} target="_blank" rel="noopener noreferrer" className="relative z-10 mt-2 self-start text-xs font-medium text-brand hover:underline">Open in Jira<span className="sr-only"> ({p.jiraKey})</span></a>}
    </li>
  );
}

/** A requester's home: every brief they sent, from the Hub's wizard or straight in Jira, with where each one stands. */
export function MyBriefs() {
  const me = useMe();
  const [briefs, setBriefs] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BriefFilter>("all");
  const [today, setToday] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    if (!isJira) repo.listUsers().then(setUsers);
  }, []);

  useEffect(() => {
    if (!me) return;
    let live = true;
    projectsRepo.myBriefs(me.id).then((b) => { if (live) { setBriefs(b); setError(null); } }).catch((e: Error) => { if (live) { setBriefs([]); setError(e.message); } });
    return () => { live = false; };
  }, [me, tick]);

  const people = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const counts = useMemo(() => summarize(briefs ?? []), [briefs]);
  const shown = useMemo(() => (today && briefs ? sortBriefs(briefs.filter((p) => matchesFilter(p, filter)), today) : []), [briefs, filter, today]);
  const first = me?.name.split(" ")[0];

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">{first ? `${first}'s briefs` : "My briefs"}</h1>
          <p className="text-sm text-muted">Everything you&apos;ve asked the creative team for, and where it stands.</p>
        </div>
        <Link href="/projects/new" className="ml-auto flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark"><Icon name="plus" size={16} /> New brief</Link>
      </div>

      <div className="mt-3"><StaleNotice /></div>
      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><Callout tone="bad" icon="alert">Couldn&apos;t load your briefs: {error}</Callout></div>
          <button onClick={() => setTick((t) => t + 1)} className="rounded-lg border border-control bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-soft">Try again</button>
        </div>
      )}

      {briefs === null ? <p className="mt-6 text-sm text-muted">Loading your briefs…</p> : briefs.length === 0 && !error ? (
        <section className="mt-6 rounded-3xl border border-dashed border-control bg-white/70 p-12 text-center">
          <Logo size={64} className="mx-auto mb-4 shadow-md" />
          <h2 className="text-xl font-bold">No briefs yet</h2>
          <p className="mx-auto mb-5 mt-1 max-w-md text-sm text-muted">Start a brief and answer a few questions. The creative team picks it up, and you can follow it here. Briefs you create in Jira show up here too.</p>
          <Link href="/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-n-50 hover:bg-brand-dark"><Icon name="plus" size={16} /> Start a brief</Link>
        </section>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {([["In progress", counts.active, "active"], ["Needs your input", counts.input, "input"], ["Delivered", counts.delivered, "delivered"]] as const).map(([label, n, f]) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-xl border bg-white p-4 text-left hover:border-brand ${filter === f ? "border-brand ring-2 ring-brand-soft" : "border-line"}`}>
                <div className="text-sm font-semibold">{label}</div>
                <div className={`text-3xl font-bold tabular-nums ${f === "input" && n > 0 ? "text-warn-fg" : ""}`}>{n}</div>
              </button>
            ))}
          </div>

          <div role="tablist" aria-label="Filter briefs" className="mt-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const n = f.id === "all" ? counts.total : f.id === "active" ? counts.active : f.id === "input" ? counts.input : counts.delivered;
              return (
                <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full border px-4 py-1.5 text-sm ${filter === f.id ? "border-brand bg-brand-soft font-medium" : "border-control bg-white hover:bg-brand-soft"}`}>
                  {f.label} <span className="text-muted">{n}</span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-control p-8 text-center text-sm text-muted">Nothing here right now.</p>
          ) : (
            <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => <BriefCard key={p.jiraKey} p={p} today={today!} people={people} />)}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
