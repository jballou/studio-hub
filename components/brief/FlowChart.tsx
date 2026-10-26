"use client";

import { useMemo } from "react";
import { OP_LABEL, QTYPE_LABEL, byId, layout, optionsOf, type Flow, type QNode } from "@/lib/brief/flow";

const NODE_W = 232;
const NODE_H = 68;
const PAD = 24;

function ruleParts(flow: Flow, n: QNode, i: number): { full: string; short: string } {
  const b = n.branches![i];
  const target = flow.nodes.find((x) => x.field === b.when.field);
  const val = target ? optionsOf(target).find((o) => o.id === b.when.value)?.label ?? b.when.value : b.when.value;
  const noValue = b.when.op === "notEmpty" || b.when.op === "empty";
  const full = `${target?.label ?? b.when.field} ${OP_LABEL[b.when.op]}${noValue ? "" : ` ${val ?? ""}`}`;
  // On the map only the answer matters ("Graphic design"); the full rule is in the tooltip and the inspector.
  const short = b.when.op === "notEmpty" ? "has answer" : b.when.op === "empty" ? "skipped" : `${b.when.op === "notEquals" ? "not " : ""}${val ?? ""}`;
  return { full, short };
}

/** Left-to-right map of the questions. Solid lines are the default route; dashed lines are rules. */
export function FlowChart({
  flow, selectedId, onSelect, scale, problemIds,
}: {
  flow: Flow;
  selectedId: string | null;
  onSelect: (id: string) => void;
  scale: number;
  problemIds: Set<string>;
}) {
  const L = useMemo(() => layout(flow, NODE_W + 76, NODE_H + 36), [flow]);
  const W = L.width + PAD * 2;
  const H = L.height + PAD * 2;

  const edges = useMemo(() => {
    const out: { key: string; d: string; dashed: boolean; label?: string; full?: string; lx: number; ly: number }[] = [];
    for (const n of flow.nodes) {
      const from = L.pos[n.id];
      if (!from) continue;
      const add = (to: string, dashed: boolean, label?: string, full?: string, idx = 0) => {
        const t = L.pos[to];
        if (!t) return;
        const x1 = from.x + PAD + NODE_W, y1 = from.y + PAD + NODE_H / 2;
        const x2 = t.x + PAD, y2 = t.y + PAD + NODE_H / 2;
        const dx = Math.max(40, (x2 - x1) / 2);
        out.push({ key: `${n.id}>${to}>${dashed ? "r" : "d"}${idx}`, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, dashed, label, full, lx: x1 + (x2 - x1) * 0.68, ly: y1 + (y2 - y1) * 0.68 });
      };
      (n.branches ?? []).forEach((b, i) => { const r = ruleParts(flow, n, i); add(b.goto, true, r.short, r.full, i); });
      if (n.next) add(n.next, false);
    }
    return out;
  }, [flow, L]);

  return (
    <div style={{ width: W * scale, height: H * scale }}>
      <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        <svg width={W} height={H} className="pointer-events-none absolute inset-0" aria-hidden>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#686764" />
            </marker>
          </defs>
          {edges.map((e) => (
            <g key={e.key}>
              <path d={e.d} fill="none" stroke="#686764" strokeWidth={1.5} strokeDasharray={e.dashed ? "5 4" : undefined} markerEnd="url(#arrow)" />
              {e.label && (
                <g>
                  <title>{e.full}</title>
                  <rect x={e.lx - Math.min(e.label.length, 22) * 3.1 - 7} y={e.ly - 9} width={Math.min(e.label.length, 22) * 6.2 + 14} height={18} rx={9} fill="#fefdfb" stroke="#d7d3cc" />
                  <text x={e.lx} y={e.ly + 4} textAnchor="middle" fontSize={10.5} fill="#464543">{e.label.length > 22 ? `${e.label.slice(0, 21)}…` : e.label}</text>
                </g>
              )}
            </g>
          ))}
        </svg>

        {flow.nodes.map((n) => {
          const p = L.pos[n.id];
          if (!p) return null;
          const sel = n.id === selectedId;
          const bad = problemIds.has(n.id);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              aria-pressed={sel}
              aria-label={`${n.label || n.prompt}. ${QTYPE_LABEL[n.qtype]}${n.id === flow.start ? ". First question" : ""}`}
              className={`absolute rounded-xl border bg-white px-3 py-2 text-left shadow-sm transition-shadow hover:shadow-md ${sel ? "border-brand ring-2 ring-brand/40" : bad ? "border-bad-fg" : "border-control"}`}
              style={{ left: p.x + PAD, top: p.y + PAD, width: NODE_W, height: NODE_H }}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {n.id === flow.start && <span className="rounded bg-brand px-1 py-px text-n-50">Start</span>}
                {QTYPE_LABEL[n.qtype]}
                {!n.required && <span className="font-normal normal-case">· optional</span>}
                {(n.branches?.length ?? 0) > 0 && <span className="ml-auto rounded-full bg-info-bg px-1.5 py-px normal-case text-info-fg">{n.branches!.length} {n.branches!.length === 1 ? "rule" : "rules"}</span>}
              </span>
              <span className="line-clamp-2 text-[13px] font-medium leading-tight">{n.prompt || <em className="text-bad-fg">No question text</em>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { byId };
