"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { formatTime } from "@/lib/calendar/csv";
import { dayLabel } from "@/lib/calendar/dates";
import { ITEM_TYPES, type CalendarItem } from "@/lib/calendar/types";
import { STATUS_TONE, TYPE_SHORT, TYPE_TONE } from "./meta";

const JIRA_BASE = "https://surveymonkey.atlassian.net";
const primary = "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark";
const secondary = "rounded-lg border border-control px-4 py-2 text-sm font-medium hover:bg-brand-soft";

type Panel = { kind: "item"; id: string } | { kind: "day"; day: string } | null;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function ItemPanel({
  panel, items, dayItems, projectKeys, onPick, onClose,
}: {
  panel: Panel;
  items: CalendarItem[];
  dayItems: CalendarItem[];
  /** Jira keys that have a project home in the app */
  projectKeys: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  if (!panel) return null;
  const item = panel.kind === "item" ? items.find((i) => i.id === panel.id) : undefined;
  const feedbackHref = item ? `/submit?title=${encodeURIComponent(item.title)}${item.jiraKey ? `&ticket=${item.jiraKey}` : ""}` : "/submit";

  return (
    <>
      <div className="fixed inset-0 z-30 bg-n-1000/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label={item ? item.title : "Items on this day"}
        className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-md flex-col overflow-y-auto border-l border-line bg-white p-5 shadow-xl"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <button onClick={onClose} aria-label="Close" className="mb-2 flex h-8 w-8 items-center justify-center self-end rounded-full hover:bg-n-150"><Icon name="x" size={16} /></button>

        {panel.kind === "day" && (
          <>
            <h2 className="mb-3 text-lg font-bold">{dayLabel(panel.day, { weekday: "long", month: "long", day: "numeric" })}</h2>
            <ul className="space-y-2">
              {dayItems.map((i) => (
                <li key={i.id}>
                  <button onClick={() => onPick(i.id)} className="flex w-full items-center gap-2 rounded-xl border border-line p-3 text-left text-sm hover:border-brand">
                    <Tag tone={TYPE_TONE[i.type]}>{TYPE_SHORT[i.type]}</Tag>
                    <span className="min-w-0 flex-1 truncate font-medium">{i.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {panel.kind === "item" && !item && <p className="text-sm text-muted">This item is no longer in the calendar.</p>}

        {item && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Tag tone={TYPE_TONE[item.type]}>{ITEM_TYPES.find((t) => t.id === item.type)?.label}</Tag>
              <Tag tone={STATUS_TONE[item.status]}>{item.status}</Tag>
              {item.statusDerived && <span className="text-xs text-muted" title="This source has no status column, so status is estimated from dates">estimated</span>}
            </div>
            <h2 className="mb-3 text-xl font-bold leading-tight">{item.title}</h2>
            <dl className="divide-y divide-line border-y border-line">
              <Row label="Date">{dayLabel(item.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{item.endDate && item.endDate !== item.date ? ` to ${dayLabel(item.endDate, { month: "short", day: "numeric" })}` : ""}{item.time != null ? ` · ${formatTime(item.time)}` : ""}</Row>
              {item.dueDate && <Row label="Creative due">{dayLabel(item.dueDate, { weekday: "short", month: "short", day: "numeric" })}</Row>}
              <Row label="Owner">{item.owner}</Row>
              {item.campaign && <Row label="Campaign">{item.campaign}</Row>}
              {item.channel && <Row label="Channel">{item.channel}</Row>}
              <Row label="Source">{item.sourceName} · {item.sourceRef}</Row>
            </dl>
            {item.description && <p className="mt-3 whitespace-pre-wrap text-sm">{item.description}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {/* Primary action first. Items tied to a known project open its home; others start a feedback request. */}
              {item.jiraKey && projectKeys.has(item.jiraKey) ? (
                <>
                  <Link href={`/projects/${item.jiraKey}`} className={primary}>Open project</Link>
                  <Link href={feedbackHref} className={secondary}>Submit for feedback</Link>
                </>
              ) : (
                <Link href={feedbackHref} className={primary}>Submit for feedback</Link>
              )}
              {item.jiraKey && (
                <a href={`${JIRA_BASE}/browse/${item.jiraKey}`} target="_blank" rel="noopener noreferrer" className={secondary}>Open in Jira</a>
              )}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className={secondary}>Open asset link</a>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
