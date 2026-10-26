"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/review/Avatar";
import { Icon } from "@/components/ui/Icon";
import { StageTag, Tag } from "@/components/ui/Tag";
import { TYPE_TONE, TYPE_SHORT } from "@/components/calendar/meta";
import { dayLabel } from "@/lib/calendar/dates";
import { formatDue } from "@/lib/time";
import { loadSource, loadSources } from "@/lib/calendar/store";
import type { CalendarItem } from "@/lib/calendar/types";
import { projectsRepo, repo } from "@/lib/data";
import type { Asset, BriefInput, Project, Stage, User } from "@/lib/types";

const JIRA_BASE = "https://surveymonkey.atlassian.net";
const STAGES: Stage[] = ["Submitted", "In review", "In progress", "In feedback", "Delivered"];
const PHASE_TIPS: Record<Stage, string[]> = {
  Submitted: ["The creative team is reading your brief", "Add anything missing in Jira comments"],
  "In review": ["The team is scoping the work", "Answer questions on the ticket quickly"],
  "In progress": ["Designs are being made", "Watch Designs for first drafts"],
  "In feedback": ["Review the designs shared with you", "Leave comments right on the design", "Approve when it's ready"],
  Delivered: ["Final files are ready", "Find them under Designs"],
};

type Tab = "overview" | "designs" | "calendar";

const BRIEF_SECTIONS: { key: keyof BriefInput; label: string }[] = [
  { key: "problem", label: "Problem statement" }, { key: "opportunity", label: "Opportunity" }, { key: "scope", label: "Scope" },
  { key: "requirements", label: "Requirements" }, { key: "antiGoals", label: "Anti-goals" }, { key: "deliverables", label: "Deliverables" },
  { key: "northStar", label: "North star" }, { key: "openQuestions", label: "Open questions" },
];

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center"><h2 className="text-lg font-semibold">{title}</h2><span className="ml-auto">{action}</span></div>
      {children}
    </section>
  );
}

export function ProjectHome({ jiraKey }: { jiraKey: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    projectsRepo.getProject(jiraKey, "u-avery").then(setProject);
    repo.listUsers().then(setUsers);
    repo.listAssets().then((a) => setAssets(a.filter((x) => x.projectKey === jiraKey)));
    Promise.all(loadSources().map(loadSource)).then((rs) => setItems(rs.flatMap((r) => r.items).filter((i) => i.jiraKey === jiraKey).sort((a, b) => a.date.localeCompare(b.date))));
  }, [jiraKey]);

  if (project === undefined) return <p className="p-8 text-sm text-muted">Loading…</p>;
  if (project === null) {
    return (
      <main className="mx-auto w-full max-w-2xl p-8">
        <h1 className="text-2xl font-bold">Project not found</h1>
        <p className="mt-2 text-sm text-muted">There&apos;s no project {jiraKey}, or you don&apos;t have access to it in Jira.</p>
        <Link href="/projects" className="mt-4 inline-block font-medium text-brand hover:underline">Back to projects</Link>
      </main>
    );
  }

  const person = (id: string) => users.find((u) => u.id === id);
  const people = [project.requesterId, ...project.collaboratorIds].map(person).filter((u): u is User => !!u);
  const current = STAGES.indexOf(project.stage);
  const next = STAGES.slice(current + 1);
  const brief = BRIEF_SECTIONS.filter((s) => project.brief?.[s.key]);

  return (
    <main className="w-full p-6">
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-sm text-muted">
        <Link href="/projects" className="hover:underline">Projects</Link>
        <Icon name="chevronRight" size={12} />
        <span>{project.jiraKey}</span>
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <StageTag stage={project.stage} />
        <div className="ml-auto flex items-center gap-3">
          <div className="flex -space-x-2" aria-label={`${people.length} people on this project`}>
            {people.slice(0, 4).map((u) => <span key={u.id} className="rounded-full ring-2 ring-white" title={u.name}><Avatar user={u} size={32} /></span>)}
          </div>
          <Link href={`/submit?ticket=${project.jiraKey}&title=${encodeURIComponent(project.title)}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Submit for feedback</Link>
          <a href={`${JIRA_BASE}/browse/${project.jiraKey}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-control bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft">Open in Jira</a>
        </div>
      </div>

      <div role="tablist" aria-label="Project sections" className="mb-5 flex gap-6 border-b border-line">
        {([["overview", "Overview", null], ["designs", "Designs", assets.length], ["calendar", "Calendar", items.length]] as const).map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${tab === id ? "border-brand text-brand" : "border-transparent text-n-800 hover:text-ink"}`}
          >
            {label}
            {n ? <span className="rounded-full bg-brand px-1.5 text-xs text-n-50">{n}</span> : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <Card title="Details">
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted">Requester: </dt><dd className="inline">{project.requesterName ?? person(project.requesterId)?.name ?? "Unknown"}</dd></div>
                <div><dt className="inline text-muted">Type: </dt><dd className="inline">{project.type}</dd></div>
                <div><dt className="inline text-muted">Date submitted: </dt><dd className="inline">{dayLabel(project.submittedAt, { month: "short", day: "numeric", year: "numeric" })}</dd></div>
                <div><dt className="inline text-muted">Deadline: </dt><dd className="inline">{project.deadline ? dayLabel(project.deadline, { month: "short", day: "numeric", year: "numeric" }) : "None set"}</dd></div>
                <div className="sm:col-span-2"><dt className="inline text-muted">Collaborators: </dt><dd className="inline">{(project.collaboratorNames ?? project.collaboratorIds.map((id) => person(id)?.name).filter(Boolean)).join(", ") || "None yet"}</dd></div>
              </dl>
            </Card>

            <Card title="Timeline">
              <ol className="flex items-start">
                {STAGES.map((s, i) => (
                  <li key={s} className="flex flex-1 flex-col items-center text-center text-xs" aria-current={i === current ? "step" : undefined}>
                    <div className="flex w-full items-center">
                      <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= current ? "bg-brand" : "bg-n-200"}`} />
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${i < current ? "border-brand bg-brand text-n-50" : i === current ? "border-brand bg-white text-brand" : "border-n-200 bg-white text-n-650"}`}>
                        {i < current ? <Icon name="check" size={14} /> : <span className="font-semibold">{i + 1}</span>}
                      </span>
                      <span className={`h-0.5 flex-1 ${i === STAGES.length - 1 ? "bg-transparent" : i < current ? "bg-brand" : "bg-n-200"}`} />
                    </div>
                    <span className={`mt-1.5 font-medium ${i === current ? "text-ink" : "text-muted"}`}>{s}</span>
                  </li>
                ))}
              </ol>
              {project.deadline && <p className="mt-4 text-sm text-muted">Deadline {dayLabel(project.deadline, { weekday: "long", month: "long", day: "numeric" })}</p>}
            </Card>

            <Card title={project.brief ? "Project brief" : "Description"}>
              {brief.length === 0 ? (
                project.description
                  ? <p className="whitespace-pre-wrap text-sm">{project.description}</p>
                  : <p className="text-sm text-muted">No brief on file for this project.</p>
              ) : (
                <div className="space-y-4">
                  {brief.map((s) => (
                    <div key={s.key}>
                      <h3 className="text-sm font-semibold">{s.label}</h3>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">{project.brief?.[s.key] as string}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <aside className="space-y-5">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Current project phase</h2>
              <div className="rounded-xl bg-n-150 p-4 text-sm">
                <p className="mb-2 font-semibold">{project.stage}</p>
                <ul className="list-disc space-y-1 pl-5">{PHASE_TIPS[project.stage].map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
            {next.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Next</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">{next.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "designs" && (
        assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-control bg-white/60 p-10 text-center">
            <p className="mb-3 text-sm text-muted">Nothing has been shared for feedback yet.</p>
            <Link href={`/submit?ticket=${project.jiraKey}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Submit for feedback</Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((a) => (
              <li key={a.id}>
                <Link href={`/review/${a.id}`} className="block rounded-xl border border-line bg-white p-4 hover:border-brand">
                  <span className="mb-2 flex items-center gap-2"><Tag tone="neutral">{a.source ? a.source.label : a.kind}</Tag><span className="text-xs text-muted">{a.versionIds.length} version{a.versionIds.length > 1 ? "s" : ""}</span></span>
                  <span className="block font-medium">{a.name}</span>
                  {a.dueAt && <span className="mt-1 block text-xs text-muted">Feedback by {formatDue(a.dueAt, a.dueTz)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "calendar" && (
        items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-control bg-white/60 p-10 text-center text-sm text-muted">No calendar items are linked to {project.jiraKey}. Add its Jira key to a row in a calendar source.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <span className="w-28 text-muted">{dayLabel(i.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                <Tag tone={TYPE_TONE[i.type]}>{TYPE_SHORT[i.type]}</Tag>
                <span className="font-medium">{i.title}</span>
                <Link href="/calendar" className="ml-auto text-xs font-medium text-brand hover:underline">View calendar</Link>
              </li>
            ))}
          </ul>
        )
      )}
    </main>
  );
}
