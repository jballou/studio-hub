"use client";

import Link from "next/link";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { Tag } from "@/components/ui/Tag";
import { PlanWork } from "@/components/projects/PlanWork";
import { dueLabel } from "@/lib/board";
import type { Project } from "@/lib/types";

const DUE_TONE = { bad: "text-bad-fg font-semibold", warn: "text-warn-fg font-semibold", muted: "text-muted" } as const;

/**
 * Open tickets assigned to you with no Start date. A start date is what makes "how long does work really take" measurable,
 * so this sits near the top of My Day until the list is empty.
 */
export function PlanWorkCard({ tickets, today, onPlanned }: { tickets: Project[]; today: string; onPlanned: (key: string, date: string) => void }) {
  if (tickets.length === 0) return null;
  const sorted = [...tickets].sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.jiraKey.localeCompare(b.jiraKey));
  return (
    <section aria-labelledby="plan-h" className="mt-4 rounded-xl border border-warn-line bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 id="plan-h" className="text-base font-bold">Plan work</h2>
        <Tag tone="warn" icon="calendarDays">{tickets.length} without a start date</Tag>
        <p className="w-full text-xs text-muted sm:ml-2 sm:w-auto">Set when work starts on each ticket you own. It feeds how long work really takes.</p>
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((p) => {
          const due = dueLabel(p.deadline, today);
          return (
            <li key={p.jiraKey} className="flex flex-wrap items-center gap-4 py-2">
              <IssueIcon level={p.issueType?.level ?? 0} typeName={p.issueType?.name} size={18} />
              <span className="min-w-0 flex-1">
                <Link href={`/projects/${p.jiraKey}`} className="block truncate text-sm font-medium hover:underline">{p.title}</Link>
                <span className="block truncate text-xs text-muted"><span className="font-mono">{p.jiraKey}</span> · {p.statusName ?? p.stage}</span>
              </span>
              {due && <span className={`text-xs ${DUE_TONE[due.tone]}`}>{due.text === "Today" || due.text === "Tomorrow" ? `Due ${due.text.toLowerCase()}` : due.tone === "bad" ? due.text : `Due ${due.text}`}</span>}
              <PlanWork project={p} onPlanned={(d) => onPlanned(p.jiraKey, d)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
