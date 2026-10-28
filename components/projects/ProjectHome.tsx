"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/review/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { Adf } from "@/components/ui/Adf";
import { StatusMenu } from "./StatusMenu";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { IssueLink, openBlockers, RelationsCard } from "./RelationsCard";
import { pastDueDays, pastDueWords } from "@/lib/pastdue";
import { localDay } from "@/lib/myday/plan";
import { TYPE_TONE, TYPE_SHORT } from "@/components/calendar/meta";
import { dayLabel } from "@/lib/calendar/dates";
import { formatDue } from "@/lib/time";
import { loadSource, loadSources } from "@/lib/calendar/store";
import type { CalendarItem } from "@/lib/calendar/types";
import { blocksRepo, isJira, projectsRepo, repo } from "@/lib/data";
import { BlockDialog } from "@/components/blocks/BlockDialog";
import { UnblockDialog } from "@/components/blocks/UnblockDialog";
import { NoStartTag, PlanWork } from "./PlanWork";
import { needsStartDate } from "@/lib/startdate";
import { daysSince, FlagTags } from "@/components/blocks/BlockedTag";
import { StarButton } from "@/components/ui/StarButton";
import { useFavorites } from "@/hooks/useFavorites";
import { useMe } from "@/hooks/useMe";
import type { Asset, BriefInput, Block, JiraSync, Project, Relations, Stage, User } from "@/lib/types";

const JIRA_BASE = "https://surveymonkey.atlassian.net";
// The timeline shows four steps. A ticket in Jira's review stage counts as In progress, so "In review" is not a step.
const STAGES: Stage[] = ["Submitted", "In progress", "In feedback", "Delivered"];
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

/** A person's name; in real mode it opens their Jira profile in a new tab. */
function NameLink({ id, name }: { id: string; name: string }) {
  if (!isJira || !id) return <>{name}</>;
  return <a href={`${JIRA_BASE}/jira/people/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer" title="Open profile in Jira" className="text-brand underline-offset-2 hover:underline">{name}</a>;
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="mb-4 flex items-center"><h2 className="text-lg font-semibold">{title}</h2><span className="ml-auto">{action}</span></div>
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
  const [block, setBlock] = useState<Block | undefined>();
  const [dialog, setDialog] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const me = useMe();
  const favs = useFavorites();
  const [today, setToday] = useState<string | null>(null);
  const [rel, setRel] = useState<Relations | null>(null);

  useEffect(() => {
    // Read in the browser so "today" is the viewer's own day.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    projectsRepo.getProject(jiraKey, "u-avery").then(setProject);
    projectsRepo.relations(jiraKey).then(setRel);
    const loadBlock = () => blocksRepo.list([jiraKey]).then((b) => setBlock(b[0])).catch(() => {});
    loadBlock();
    window.addEventListener("blocks-changed", loadBlock);
    repo.listUsers().then(setUsers);
    repo.listAssets().then((a) => setAssets(a.filter((x) => x.projectKey === jiraKey)));
    Promise.all(loadSources().map(loadSource)).then((rs) => setItems(rs.flatMap((r) => r.items).filter((i) => i.jiraKey === jiraKey).sort((a, b) => a.date.localeCompare(b.date))));
    return () => window.removeEventListener("blocks-changed", loadBlock);
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
  const shownStage: Stage = project.stage === "In review" ? "In progress" : project.stage;
  const current = STAGES.indexOf(shownStage);
  const next = STAGES.slice(current + 1);
  const canManage = me?.role === "creative";
  const iHoldIt = !!block && me?.id === block.blockedBy.id;
  const reloadBlock = () => blocksRepo.list([jiraKey]).then((b) => setBlock(b[0])).catch(() => {});

  const isBlocked = !!block || project.flag === "blocked";
  const late = today ? pastDueDays(project, today) : null;
  const reloadProject = () => projectsRepo.getProject(jiraKey, "u-avery").then((p) => p && setProject(p));
  const collaborators = project.collaboratorIds.map((id, i) => ({ id, name: project.collaboratorNames?.[i] ?? person(id)?.name ?? "" })).filter((c) => c.name);
  // The person it's waiting on can clear a named block; a Blocked ticket with nobody named is for the creative team.
  const canUnblock = isBlocked && (canManage || iHoldIt);
  const afterUnblock = async ({ status, jira }: { status: string; jira?: JiraSync }) => {
    setUnblocking(false);
    setBlockError(jira && !jira.ok ? `Unblocked here, but Jira's status didn't change. ${jira.reason}` : null);
    reloadBlock();
    // Real data: re-read the ticket so the status and tags match Jira. Demo data has no backend, so update the view directly.
    if (isJira) projectsRepo.getProject(jiraKey, "u-avery").then((p) => p && setProject(p));
    else setProject({ ...project, flag: undefined, stage: status === "In Progress" ? "In progress" : project.stage });
  };

  const brief = BRIEF_SECTIONS.filter((s) => project.brief?.[s.key]);

  return (
    <main className="w-full p-6">
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-muted">
        <Link href="/projects" className="hover:underline">Projects</Link>
        {(rel?.ancestors ?? []).map((a) => (
          <span key={a.key} className="flex min-w-0 items-center gap-2">
            <Icon name="chevronRight" size={12} />
            <IssueIcon level={a.level} typeName={a.typeName} size={14} />
            <IssueLink r={a} className="max-w-48 truncate" />
          </span>
        ))}
        <Icon name="chevronRight" size={12} />
        <span className="flex items-center gap-2"><IssueIcon level={project.issueType?.level ?? 0} typeName={project.issueType?.name} size={14} />{project.jiraKey}</span>
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <StarButton starred={favs.isStarred(project.jiraKey)} onToggle={() => favs.toggle(project.jiraKey, project.title)} label={project.title} />
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <StatusMenu project={project} canChange={canManage} onChanged={reloadProject} />
        {late !== null && <Tag tone="bad" icon="alert">Past due · {pastDueWords(late)}</Tag>}
        <FlagTags flag={project.flag} block={block} />
        {needsStartDate(project) && <NoStartTag />}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex -space-x-2" aria-label={`${people.length} people on this project`}>
            {people.slice(0, 4).map((u) => <span key={u.id} className="rounded-full ring-2 ring-white" title={u.name}><Avatar user={u} size={32} /></span>)}
          </div>
          <Link href={`/submit?ticket=${project.jiraKey}&title=${encodeURIComponent(project.title)}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Submit for feedback</Link>
          <a href={`${JIRA_BASE}/browse/${project.jiraKey}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-control bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft">Open in Jira</a>
          {needsStartDate(project) && canManage && <PlanWork size="md" project={project} onPlanned={(d) => setProject({ ...project, startDate: d })} />}
          {canUnblock && project.group !== "closed" && (
            <button onClick={() => setUnblocking(true)} className="rounded-lg border border-control bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft">Mark as unblocked</button>
          )}
          {canManage && !isBlocked && project.group !== "closed" && (
            <button onClick={() => setDialog(true)} className="rounded-lg border border-control bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft">Mark as blocked</button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Project sections" className="mb-6 flex gap-6 border-b border-line">
        {([["overview", "Overview", null], ["designs", "Designs", assets.length], ["calendar", "Calendar", items.length]] as const).map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2 text-sm font-medium ${tab === id ? "border-brand text-brand" : "border-transparent text-n-800 hover:text-ink"}`}
          >
            {label}
            {n ? <span className="rounded-full bg-brand px-2 text-xs text-n-50">{n}</span> : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            {late !== null && (
              <section role="alert" aria-label="Past due" className="rounded-xl border border-bad-line bg-bad-bg p-4 text-bad-fg">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon name="alert" size={18} /> Past due by {pastDueWords(late)}</h2>
                <p className="mt-2 text-sm">The deadline was {dayLabel(project.deadline, { weekday: "long", month: "long", day: "numeric" })} and this ticket is still {project.statusName ?? project.stage}.</p>
              </section>
            )}
            {(block || project.flag === "blocked") && (
              <section className="rounded-xl border border-bad-line bg-bad-bg p-6 text-bad-fg" aria-label="Blocked">
                <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Icon name="close" size={18} /> {block ? `Blocked by ${block.blockedBy.name}` : "Blocked in Jira, but nobody is named"}</h2>
                {block ? (
                  <>
                    <p className="text-sm">{block.reason}</p>
                    <p className="mt-2 text-xs">For {daysSince(block.since)} {daysSince(block.since) === 1 ? "day" : "days"} · marked by {block.setBy}</p>
                    {iHoldIt && <p className="mt-2 text-sm font-medium">This is waiting on you. Clear it once you&apos;ve done what&apos;s needed.</p>}
                  </>
                ) : (
                  <p className="text-sm">Say who it&apos;s waiting on so they get a notification and can act on it.</p>
                )}
                {blockError && <p role="alert" className="mt-2 text-sm font-medium">{blockError}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {canUnblock && <button onClick={() => setUnblocking(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">{iHoldIt ? "I\u2019ve unblocked this" : "Mark as unblocked"}</button>}
                  {canManage && <button onClick={() => setDialog(true)} className="rounded-lg border border-control bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-brand-soft">{block ? "Change who" : "Name who it\u2019s waiting on"}</button>}
                </div>
              </section>
            )}

            {openBlockers(rel).length > 0 && (
              <section role="status" aria-label="Linked blockers" className="rounded-xl border border-warn-line bg-warn-bg p-4 text-warn-fg">
                <h2 className="flex items-center gap-2 text-base font-semibold"><Icon name="block" size={16} /> Waiting on linked work</h2>
                <p className="mt-2 text-sm">{openBlockers(rel).map((l, i) => <span key={l.key}>{i > 0 && ", "}<IssueLink r={l} className="font-medium underline" /> ({l.status})</span>)} {openBlockers(rel).length === 1 ? "is" : "are"} linked as blocking this ticket and not finished yet.</p>
              </section>
            )}

            <Card title="Details">
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted">Requester: </dt><dd className="inline"><NameLink id={project.requesterId} name={project.requesterName ?? person(project.requesterId)?.name ?? "Unknown"} /></dd></div>
                <div><dt className="inline text-muted">Type: </dt><dd className="inline-flex items-center gap-2 align-middle"><IssueIcon level={project.issueType?.level ?? 0} typeName={project.issueType?.name} size={14} />{project.issueType?.name ?? project.type}</dd></div>
                {project.startDate !== undefined && <div><dt className="inline text-muted">Start date: </dt><dd className="inline">{project.startDate ? dayLabel(project.startDate, { month: "short", day: "numeric", year: "numeric" }) : "Not set"}</dd></div>}
                <div><dt className="inline text-muted">Date submitted: </dt><dd className="inline">{dayLabel(project.submittedAt, { month: "short", day: "numeric", year: "numeric" })}</dd></div>
                <div><dt className="inline text-muted">Deadline: </dt><dd className={`inline ${late !== null ? "font-semibold text-bad-fg" : ""}`}>{project.deadline ? dayLabel(project.deadline, { month: "short", day: "numeric", year: "numeric" }) : "None set"}{late !== null ? ` (${pastDueWords(late)} late)` : ""}</dd></div>
                <div className="sm:col-span-2"><dt className="inline text-muted">Collaborators: </dt><dd className="inline">{collaborators.length ? collaborators.map((c, i) => <span key={c.id}>{i > 0 && ", "}<NameLink id={c.id} name={c.name} /></span>) : "None yet"}</dd></div>
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
                    <span className={`mt-2 font-medium ${i === current ? "text-ink" : "text-muted"}`}>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-sm text-muted">
                {project.statusName && <>Jira status: <b className="text-ink">{project.statusName}</b>{project.deadline ? " · " : ""}</>}
                {project.deadline && (late !== null ? <span className="font-semibold text-bad-fg">Past due: deadline was {dayLabel(project.deadline, { weekday: "long", month: "long", day: "numeric" })}</span> : <>Deadline {dayLabel(project.deadline, { weekday: "long", month: "long", day: "numeric" })}</>)}
              </p>
            </Card>

            {rel && <RelationsCard project={project} rel={rel} />}

            <Card title={project.brief || project.briefSections ? "Project brief" : "Description"}>
              {project.briefSections?.length ? (
                <div className="space-y-4">
                  {project.briefSections.map((x) => (
                    <div key={x.label}><h3 className="text-sm font-semibold">{x.label}</h3><p className="mt-0 whitespace-pre-wrap text-sm">{x.value}</p></div>
                  ))}
                </div>
              ) : brief.length === 0 ? (
                project.descriptionAdf
                  ? <Adf doc={project.descriptionAdf} />
                  : project.description
                  ? <p className="whitespace-pre-wrap text-sm">{project.description}</p>
                  : <p className="text-sm text-muted">No brief on file for this project.</p>
              ) : (
                <div className="space-y-4">
                  {brief.map((s) => (
                    <div key={s.key}>
                      <h3 className="text-sm font-semibold">{s.label}</h3>
                      <p className="mt-0 whitespace-pre-wrap text-sm">{project.brief?.[s.key] as string}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <aside className="space-y-6">
            <div>
              <h2 className="mb-2 text-muted eyebrow">Current project phase</h2>
              <div className="rounded-xl bg-n-150 p-4 text-sm">
                <p className="mb-2 font-semibold">{shownStage}</p>
                <ul className="list-disc space-y-2 pl-6">{PHASE_TIPS[shownStage].map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
            {next.length > 0 && (
              <div>
                <h2 className="mb-2 text-muted eyebrow">Next</h2>
                <ul className="list-disc space-y-2 pl-6 text-sm">{next.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "designs" && (
        assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-control bg-white/60 p-10 text-center">
            <p className="mb-4 text-sm text-muted">Nothing has been shared for feedback yet.</p>
            <Link href={`/submit?ticket=${project.jiraKey}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Submit for feedback</Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((a) => (
              <li key={a.id}>
                <Link href={`/review/${a.id}`} className="block rounded-xl border border-line bg-white p-4 hover:border-brand">
                  <span className="mb-2 flex items-center gap-2"><Tag tone="neutral">{a.source ? a.source.label : a.kind}</Tag><span className="text-xs text-muted">{a.versionIds.length} version{a.versionIds.length > 1 ? "s" : ""}</span></span>
                  <span className="block font-medium">{a.name}</span>
                  {a.dueAt && <span className="mt-2 block text-xs text-muted">Feedback by {formatDue(a.dueAt, a.dueTz)}</span>}
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
              <li key={i.id} className="flex items-center gap-4 rounded-xl border border-line bg-white px-4 py-4 text-sm">
                <span className="w-28 text-muted">{dayLabel(i.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                <Tag tone={TYPE_TONE[i.type]}>{TYPE_SHORT[i.type]}</Tag>
                <span className="font-medium">{i.title}</span>
                <Link href="/calendar" className="ml-auto text-xs font-medium text-brand hover:underline">View calendar</Link>
              </li>
            ))}
          </ul>
        )
      )}
      {unblocking && <UnblockDialog ticketKey={project.jiraKey} previousStatus={block?.previousStatus} onClose={() => setUnblocking(false)} onDone={afterUnblock} />}
      {dialog && <BlockDialog ticketKey={project.jiraKey} existing={block} onClose={() => setDialog(false)} onSaved={() => { setDialog(false); reloadBlock(); }} />}
    </main>
  );
}
