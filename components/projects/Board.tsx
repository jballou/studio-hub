"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FlagTags } from "@/components/blocks/BlockedTag";
import { Icon } from "@/components/ui/Icon";
import { StarButton } from "@/components/ui/StarButton";
import { Callout, StatusTag, Tag } from "@/components/ui/Tag";
import { NoStartTag, PlanWork } from "./PlanWork";
import { needsStartDate } from "@/lib/startdate";
import { projectsRepo, tasksRepo } from "@/lib/data";
import { celebrate } from "@/lib/celebrate";
import { buildCards, COLUMNS, dragBlocker, dueLabel, taskPatchFor, type BoardCard, type ColumnId } from "@/lib/board";
import type { Block, PersonalTask, Project } from "@/lib/types";

const COLLAPSED = 10;
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const DUE_TONE = { bad: "text-bad-fg font-semibold", warn: "text-warn-fg font-semibold", muted: "text-muted" } as const;

/** Chip that tells tickets (from Jira) from tasks (made here) at a glance. Icon plus word, never color alone. */
export function KindChip({ kind }: { kind: "ticket" | "task" }) {
  return kind === "ticket"
    ? <Tag tone="info" icon="ticket">Jira ticket</Tag>
    : <Tag tone="progress" icon="task">My task</Tag>;
}

export function Board({
  projects, tasks, blocks, canMove, isStarred, toggleStar, onTicketsChanged, onTasks, onPlanned, today,
}: {
  projects: Project[];
  tasks: PersonalTask[];
  blocks: Record<string, Block>;
  /** Creative team can change ticket statuses; anyone can move their own tasks. */
  canMove: boolean;
  isStarred: (k: string) => boolean;
  toggleStar: (k: string, t: string) => void;
  onTicketsChanged: () => void;
  /** called after a ticket's start date is saved */
  onPlanned: () => void;
  onTasks: (t: PersonalTask[]) => void;
  today: string;
}) {
  const [override, setOverride] = useState<Record<string, ColumnId>>({});
  const [over, setOver] = useState<ColumnId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ card: BoardCard; col: ColumnId } | null>(null);
  const [show, setShow] = useState({ ticket: true, task: true });
  const [expanded, setExpanded] = useState<Partial<Record<ColumnId, boolean>>>({});
  const [adding, setAdding] = useState<ColumnId | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const dragged = useRef<BoardCard | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  const all = useMemo(() => buildCards(projects, tasks, override), [projects, tasks, override]);
  const cards = all.filter((c) => show[c.kind]);
  const counts = { ticket: all.filter((c) => c.kind === "ticket").length, task: all.filter((c) => c.kind === "task").length };
  const keyOf = (c: BoardCard) => `${c.kind}:${c.id}`;
  const clear = (c: BoardCard) => setOverride((o) => { const n = { ...o }; delete n[keyOf(c)]; return n; });

  const run = async (card: BoardCard, col: ColumnId) => {
    setError(null);
    setOverride((o) => ({ ...o, [keyOf(card)]: col }));
    try {
      if (card.kind === "task") {
        const patch = taskPatchFor(col);
        onTasks((await tasksRepo.update(card.id, patch)).tasks);
      } else {
        await projectsRepo.moveTo(card.id, COLUMNS.find((c) => c.id === col)!.jiraStatus);
        onTicketsChanged();
      }
      // Only after the move worked: finishing something earns the confetti.
      if (col === "done") celebrate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't move that card.");
    }
    clear(card);
  };

  const move = (card: BoardCard, col: ColumnId) => {
    if (card.column === col) return;
    if (card.kind === "ticket") {
      const why = dragBlocker(card.project, canMove);
      if (why) { setError(why); return; }
      if (col === "done") { setConfirm({ card, col }); return; }
    }
    void run(card, col);
  };

  const addTask = async (col: ColumnId, title: string) => {
    if (!title.trim()) return;
    setError(null);
    try {
      const patch = taskPatchFor(col);
      const s = await tasksRepo.add({ title, lane: patch.lane });
      onTasks(s.tasks);
      setAdding(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that task.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold">Cards</span>
        {([["ticket", "Jira tickets"], ["task", "My tasks"]] as const).map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-full border border-control bg-white px-4 py-2 hover:bg-brand-soft">
            <input type="checkbox" checked={show[k]} onChange={() => setShow({ ...show, [k]: !show[k] })} className="accent-brand" />
            <Icon name={k === "ticket" ? "ticket" : "task"} size={14} /> {label} <span className="text-muted">{counts[k]}</span>
          </label>
        ))}
        <span className="text-xs text-muted">{canMove ? "Drag a card to a new column, or use ⋯ to move it." : "You can move your own tasks. Ticket statuses are changed by the creative team."}</span>
      </div>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[60rem] grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const inCol = cards.filter((c) => c.column === col.id);
            const shown = expanded[col.id] ? inCol : inCol.slice(0, COLLAPSED);
            return (
              <section
                key={col.id}
                aria-label={`${col.label}, ${inCol.length}`}
                onDragOver={(e) => { if (dragged.current) { e.preventDefault(); setOver(col.id); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); setOver(null); const c = dragged.current; dragged.current = null; if (c) move(c, col.id); }}
                className={`rounded-2xl bg-n-150 p-2 transition-shadow ${over === col.id ? "ring-2 ring-brand" : ""}`}
              >
                <h2 className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold">
                  <Icon name={col.icon} size={16} />
                  {col.label}
                  <span className="font-normal text-muted">({inCol.length})</span>
                  {col.id !== "done" && (
                    <button onClick={() => setAdding(adding === col.id ? null : col.id)} aria-label={`Add a task to ${col.label}`} title="Add a task here" className="ml-auto flex h-6 w-6 items-center justify-center rounded-md hover:bg-white"><Icon name="plus" size={14} /></button>
                  )}
                </h2>
                {adding === col.id && <QuickAdd onAdd={(t) => addTask(col.id, t)} onCancel={() => setAdding(null)} />}
                <ul className="space-y-2">
                  {shown.map((c) => (
                    <li key={keyOf(c)}>
                      <Card
                        card={c} blocks={blocks} today={today} canMove={canMove} onPlanned={onPlanned} starred={c.kind === "ticket" && isStarred(c.id)}
                        onStar={() => c.kind === "ticket" && toggleStar(c.id, c.project.title)}
                        onDragStart={() => { dragged.current = c; }} onDragEnd={() => { dragged.current = null; setOver(null); }}
                        menuOpen={menu === keyOf(c)} onMenu={() => setMenu(menu === keyOf(c) ? null : keyOf(c))} onMove={(to) => { setMenu(null); move(c, to); }}
                      />
                    </li>
                  ))}
                  {inCol.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted">{over === col.id ? "Drop here" : "Nothing here."}</li>}
                </ul>
                {inCol.length > COLLAPSED && (
                  <button onClick={() => setExpanded({ ...expanded, [col.id]: !expanded[col.id] })} aria-expanded={!!expanded[col.id]} className="mt-2 flex items-center gap-2 px-2 text-sm font-medium text-brand hover:underline">
                    <Icon name={expanded[col.id] ? "chevronDown" : "chevronRight"} size={12} />
                    {expanded[col.id] ? "Show fewer" : `View ${inCol.length - COLLAPSED} more`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {confirm && confirm.card.kind === "ticket" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-n-1000/40 p-4 pt-[14vh]" onMouseDown={() => setConfirm(null)}>
          <div role="dialog" aria-modal="true" aria-label="Close ticket" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Move to Done?</h2>
            <p className="mb-4 mt-2 text-sm text-muted">{confirm.card.id} · {confirm.card.project.title}. This closes the ticket in Jira.</p>
            <div className="flex gap-2">
              <button autoFocus onClick={() => { const c = confirm; setConfirm(null); void run(c.card, c.col); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Move to Done</button>
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-control px-4 py-2 text-sm font-medium hover:bg-brand-soft">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAdd({ onAdd, onCancel }: { onAdd: (t: string) => void; onCancel: () => void }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAdd(v); }} className="mb-2 rounded-xl border border-brand bg-white p-2">
      <label className="sr-only" htmlFor="quick-task">New task</label>
      <input id="quick-task" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onCancel()} maxLength={200} placeholder="New task, then Enter" className="w-full bg-transparent px-2 py-2 text-sm outline-none" />
      <p className="px-2 text-xs text-muted">Private to you. Not added to Jira.</p>
    </form>
  );
}

function Card({
  card, blocks, today, canMove, onPlanned, starred, onStar, onDragStart, onDragEnd, menuOpen, onMenu, onMove,
}: {
  card: BoardCard; blocks: Record<string, Block>; today: string; canMove: boolean; onPlanned: () => void; starred: boolean; onStar: () => void;
  onDragStart: () => void; onDragEnd: () => void; menuOpen: boolean; onMenu: () => void; onMove: (to: ColumnId) => void;
}) {
  const isTicket = card.kind === "ticket";
  const draggable = !isTicket || dragBlocker(card.project, canMove) === null;
  const due = dueLabel(isTicket ? card.project.deadline || undefined : card.task.date, today);
  const names = isTicket ? card.project.collaboratorNames ?? [] : [];
  return (
    <article
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", `${card.kind}:${card.id}`); onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`rounded-xl border border-line bg-white p-4 shadow-sm hover:border-brand ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <KindChip kind={card.kind} />
        <span className="ml-auto flex items-center">
          {isTicket && <StarButton starred={starred} onToggle={onStar} label={card.project.title} />}
          <span className="relative">
            <button onClick={(e) => { e.stopPropagation(); onMenu(); }} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Move ${isTicket ? card.project.title : card.task.title}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-n-700 hover:bg-n-150"><Icon name="more" size={16} /></button>
            {menuOpen && (
              <ul role="menu" className="absolute right-0 top-full z-20 mt-2 w-40 rounded-xl border border-line bg-white p-2 shadow-lg">
                <li className="px-2 py-2 text-muted eyebrow">Move to</li>
                {COLUMNS.map((c) => (
                  <li key={c.id} role="none">
                    <button role="menuitem" disabled={c.id === card.column} onClick={(e) => { e.stopPropagation(); onMove(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm enabled:hover:bg-brand-soft disabled:opacity-40"><Icon name={c.icon} size={14} />{c.label}</button>
                  </li>
                ))}
              </ul>
            )}
          </span>
        </span>
      </div>

      {isTicket
        ? <><Link href={`/projects/${card.id}`} draggable={false} className="block font-semibold hover:underline">{card.project.title}</Link><p className="mt-0 text-xs text-muted">{card.id} · {card.project.type}</p></>
        : <h3 className={`font-semibold ${card.task.done ? "text-muted line-through" : ""}`}>{card.task.title}</h3>}
      {(isTicket ? card.project.description : card.task.notes) && (
        <p className="mt-2 line-clamp-2 text-sm text-muted">{isTicket ? card.project.description : card.task.notes}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isTicket && <StatusTag project={card.project} />}
        {isTicket && <FlagTags flag={card.project.flag === "blocked" && !blocks[card.id] ? "blocked" : card.project.flag === "blocked" ? undefined : card.project.flag} block={blocks[card.id]} />}
        {isTicket && card.project.actionRequired && <Tag tone="warn" icon="alert">Action required</Tag>}
        {isTicket && needsStartDate(card.project) && <NoStartTag />}
        
        {!isTicket && card.task.backup === "synced" && <Tag tone="ok">In Google Tasks</Tag>}
        {!isTicket && card.task.backup === "pending" && <Tag tone="warn">Backup pending</Tag>}
      </div>

      {isTicket && canMove && needsStartDate(card.project) && <div className="mt-2"><PlanWork project={card.project} onPlanned={onPlanned} /></div>}

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-2 text-xs">
        <span className="flex -space-x-2">
          {names.slice(0, 3).map((n) => <span key={n} title={n} className="flex h-6 w-6 items-center justify-center rounded-full bg-n-150 text-xs font-bold ring-2 ring-white">{initials(n)}</span>)}
          {!isTicket && <span title="You" className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-xs font-bold ring-2 ring-white">You</span>}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Icon name="calendar" size={12} />
          {due ? <span className={DUE_TONE[due.tone]}>{due.text}</span> : <span className="text-muted">No due date</span>}
        </span>
      </div>
    </article>
  );
}

