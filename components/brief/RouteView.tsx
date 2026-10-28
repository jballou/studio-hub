"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { QTYPE_LABEL, type Flow } from "@/lib/brief/flow";
import { flatten, routeFor, sharedCounts, typeChoices, type RouteItem } from "@/lib/brief/routes";

function Card({ item, n, selectedId, onSelect, problemIds, shared, startId }: { item: RouteItem; n: string; selectedId: string | null; onSelect: (id: string) => void; problemIds: Set<string>; shared: Map<string, number>; startId: string }) {
  const node = item.node;
  const sel = node.id === selectedId;
  const common = (shared.get(node.id) ?? 0) > 1 && node.id !== startId;
  return (
    <div>
      <button
        type="button" onClick={() => onSelect(node.id)} aria-pressed={sel}
        className={`flex w-full items-start gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${sel ? "border-brand ring-2 ring-brand/40" : problemIds.has(node.id) ? "border-bad-fg" : "border-line hover:border-control"}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-n-150 text-xs font-bold tabular-nums">{n}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{node.prompt || <em className="text-bad-fg">No question text</em>}</span>
          <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{QTYPE_LABEL[node.qtype]}</span>
            {!node.required && <span>· optional</span>}
            {common ? <Tag tone="neutral">Shared with other types</Tag> : node.id !== startId && <Tag tone="info">Only this type</Tag>}
          </span>
        </span>
      </button>
      {item.forks.map((f, i) => (
        <div key={i} className="ml-8 mt-2 border-l-2 border-dashed border-control pl-4">
          <div className="-ml-4 mb-2 flex items-center gap-2"><span className="h-px w-4 bg-control" aria-hidden="true" /><Tag tone="progress" icon="chevronRight">If {f.label}</Tag></div>
          <div className="space-y-2">
            {f.items.map((c, j) => <Card key={c.node.id} item={c} n={`${n}.${i + 1}${f.items.length > 1 ? String.fromCharCode(97 + j) : ""}`} selectedId={selectedId} onSelect={onSelect} problemIds={problemIds} shared={shared} startId={startId} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The questions one kind of request is asked, in order, as a simple list. Follow-up questions that only appear for certain
 * answers sit indented under the question that triggers them.
 */
export function RouteView({ flow, selectedId, onSelect, problemIds }: { flow: Flow; selectedId: string | null; onSelect: (id: string) => void; problemIds: Set<string> }) {
  const tc = useMemo(() => typeChoices(flow), [flow]);
  const [typeId, setTypeId] = useState<string | null>(null);
  const shared = useMemo(() => sharedCounts(flow), [flow]);
  const current = tc?.options.find((o) => o.id === typeId) ?? tc?.options[0];
  const route = useMemo(() => (tc && current ? routeFor(flow, tc.node.field, current.id) : []), [flow, tc, current]);
  const counts = useMemo(() => new Map((tc?.options ?? []).map((o) => [o.id, flatten(routeFor(flow, tc!.node.field, o.id)).length])), [flow, tc]);

  if (!tc || !current) return <p className="p-6 text-sm text-muted">This flow has no &ldquo;request type&rdquo; question, so there is nothing to group by. Use the full map instead.</p>;
  return (
    <div className="flex flex-col gap-4 p-4">
      <nav aria-label="Request types">
        <p className="eyebrow mb-2 text-muted">Request type</p>
        <ul className="flex flex-wrap gap-2">
          {tc.options.map((o) => (
            <li key={o.id}>
              <button onClick={() => setTypeId(o.id)} aria-current={o.id === current.id} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${o.id === current.id ? "border-brand bg-brand-soft font-medium" : "border-line hover:bg-n-150"}`}>
                <span>{o.label}</span>
                <span className="text-xs tabular-nums text-muted">{counts.get(o.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-label={`Questions for ${current.label}`} className="min-w-0 flex-1">
        <h2 className="mb-2 text-lg font-bold">{current.label}</h2>
        <p className="mb-4 text-sm text-muted">What someone is asked, in order. Click a question to edit it. Indented questions only appear for certain answers.</p>
        <ol className="space-y-2">
          {route.map((item, i) => (
            <li key={item.node.id} className="relative">
              {i < route.length - 1 && <span className="absolute left-8 top-full h-2 w-px bg-control" aria-hidden="true" />}
              <Card item={item} n={String(i + 1)} selectedId={selectedId} onSelect={onSelect} problemIds={problemIds} shared={shared} startId={flow.start} />
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Icon name="check" size={14} /> Then the brief is sent to Jira.</p>
      </section>
    </div>
  );
}
