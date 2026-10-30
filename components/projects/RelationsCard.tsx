"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { StatusTag, Tag } from "@/components/ui/Tag";
import type { IssueRef, LinkKind, LinkRef, Project, Relations } from "@/lib/types";

const JIRA_BASE = "https://surveymonkey.atlassian.net";

/** A ticket link: opens its page here when it's a Brand Creative ticket, otherwise in Jira. */
export function IssueLink({ r, className = "" }: { r: Pick<IssueRef, "key" | "title" | "inHub">; className?: string }) {
  return r.inHub
    ? <Link href={`/projects/${r.key}`} className={`hover:underline ${className}`}>{r.title}</Link>
    : <a href={`${JIRA_BASE}/browse/${r.key}`} target="_blank" rel="noopener noreferrer" className={`hover:underline ${className}`}>{r.title}<span className="sr-only"> (opens in Jira)</span></a>;
}

const statusProps = (r: IssueRef) => ({ stage: "Submitted" as const, statusName: r.status, statusCategory: r.statusCategory });

function Row({ r, here }: { r: IssueRef; here?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-sm ${here ? "bg-brand-soft" : "hover:bg-n-100"}`}>
      <IssueIcon level={r.level} typeName={r.typeName} />
      <span className="font-mono text-xs text-muted">{r.key}</span>
      {here ? <span className="font-semibold">{r.title}</span> : <IssueLink r={r} className="min-w-0 flex-1 truncate font-medium" />}
      {here && <Tag tone="ok">This ticket</Tag>}
      {r.status && <StatusTag project={statusProps(r)} />}
      {!r.inHub && <span title="Opens in Jira" className="text-muted"><Icon name="link" size={12} /></span>}
    </div>
  );
}

function Nested({ children }: { children: React.ReactNode }) {
  return <ul className="ml-4 space-y-0 border-l-2 border-line pl-4">{children}</ul>;
}

const LINK_GROUPS: { kind: LinkKind; title: string }[] = [
  { kind: "blockedBy", title: "Blocked by" },
  { kind: "blocks", title: "Blocks" },
  { kind: "related", title: "Related" },
  { kind: "other", title: "Other links" },
];

/** True when this ticket is linked as blocked by something that isn't finished. */
export const openBlockers = (rel: Relations | null): LinkRef[] => (rel?.links ?? []).filter((l) => l.kind === "blockedBy" && l.statusCategory !== "done");

/** Hierarchy (initiative, epic, this ticket, children, sub-tasks) and linked work (blocked by, blocks, related). */
export function RelationsCard({ project, rel }: { project: Project; rel: Relations }) {
  const me: IssueRef = {
    key: project.jiraKey, title: project.title, typeName: project.issueType?.name ?? "Task", level: project.issueType?.level ?? 0,
    status: project.statusName ?? project.stage, statusCategory: project.statusCategory ?? "indeterminate", inHub: true,
  };
  const hasTree = rel.ancestors.length > 0 || rel.children.length > 0;
  const done = rel.children.filter((c) => c.statusCategory === "done").length;
  const pct = rel.children.length ? Math.round((done / rel.children.length) * 100) : 0;

  // Ancestors nest one inside the next, then this ticket, then its children.
  const tree = (i: number): React.ReactNode => {
    if (i < rel.ancestors.length) {
      return <li key={rel.ancestors[i].key}><Row r={rel.ancestors[i]} /><Nested>{tree(i + 1)}</Nested></li>;
    }
    return (
      <li key={me.key}>
        <Row r={me} here />
        {rel.children.length > 0 && (
          <Nested>
            {rel.children.map((c) => (
              <li key={c.key}>
                <Row r={c} />
                {c.subtasks.length > 0 && <Nested>{c.subtasks.map((s) => <li key={s.key}><Row r={s} /></li>)}</Nested>}
              </li>
            ))}
          </Nested>
        )}
      </li>
    );
  };

  return (
    <>
      {hasTree && (
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Hierarchy</h2>
          <ul>{tree(0)}</ul>
          {rel.children.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-2 flex justify-between text-xs text-muted"><span>{done} of {rel.children.length} {rel.children.length === 1 ? "item" : "items"} done</span><span>{pct}%</span></div>
              <div role="meter" aria-label="Child items done" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-n-150"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(pct, 2)}%` }} /></div>
            </div>
          )}
        </section>
      )}
      {rel.links.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Linked work</h2>
          <div className="space-y-4">
            {LINK_GROUPS.map((g) => {
              const items = rel.links.filter((l) => l.kind === g.kind);
              if (!items.length) return null;
              const hot = g.kind === "blockedBy" && items.some((l) => l.statusCategory !== "done");
              return (
                <div key={g.kind}>
                  <h3 className={`mb-2 flex items-center gap-2 eyebrow ${hot ? "text-bad-fg" : "text-muted"}`}>
                    {(g.kind === "blockedBy" || g.kind === "blocks") && <Icon name="block" size={13} />}{g.title}
                  </h3>
                  <ul className="space-y-0">{items.map((l) => <li key={`${l.key}-${l.label}`}><Row r={l} />{g.kind === "other" && <p className="pl-10 text-xs text-muted">{l.label}</p>}</li>)}</ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
