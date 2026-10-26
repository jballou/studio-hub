"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { formatTime } from "@/lib/calendar/csv";
import { addDays, dayLabel, fromIso, monthGrid, monthLabel, shiftMonth, spanDays, startOfWeek, todayIso } from "@/lib/calendar/dates";
import { loadSource, loadSources } from "@/lib/calendar/store";
import { ITEM_TYPES, STATUSES, type CalendarItem, type CalendarSource, type ItemType, type SourceResult } from "@/lib/calendar/types";
import { ItemPanel } from "./ItemPanel";
import { STATUS_TONE, TYPE_BAR, TYPE_SHORT, TYPE_TONE } from "./meta";

type View = "month" | "week" | "list";
type Panel = { kind: "item"; id: string } | { kind: "day"; day: string } | null;

const byTime = (a: CalendarItem, b: CalendarItem) => (a.time ?? 1e9) - (b.time ?? 1e9) || a.title.localeCompare(b.title);
const sel = "rounded-lg border border-control bg-white px-2 py-1.5 text-sm";

function Chip({ item, onOpen }: { item: CalendarItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title={`${TYPE_SHORT[item.type]}: ${item.title}`}
      className="flex w-full items-center gap-1 truncate rounded border border-line bg-white py-0.5 pl-1.5 pr-1 text-left text-[11px] hover:bg-brand-soft"
      style={{ borderLeft: `3px solid ${TYPE_BAR[item.type]}` }}
    >
      <b className="shrink-0">{TYPE_SHORT[item.type]}</b>
      <span className="truncate">{item.title}</span>
    </button>
  );
}

export function CalendarView() {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [results, setResults] = useState<SourceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(todayIso());
  const [types, setTypes] = useState<Set<ItemType>>(new Set());
  const [owner, setOwner] = useState("");
  const [campaign, setCampaign] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState<Panel>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const srcs = loadSources();
    setSources(srcs);
    setResults(await Promise.all(srcs.map(loadSource)));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const all = useMemo(() => results.flatMap((r) => r.items), [results]);
  const owners = useMemo(() => [...new Set(all.map((i) => i.owner))].sort(), [all]);
  const campaigns = useMemo(() => [...new Set(all.map((i) => i.campaign).filter(Boolean))].sort(), [all]);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((i) =>
      (types.size === 0 || types.has(i.type)) && (!owner || i.owner === owner) && (!campaign || i.campaign === campaign) &&
      (!source || i.sourceId === source) && (!status || i.status === status) &&
      (!t || `${i.title} ${i.description} ${i.campaign} ${i.channel ?? ""} ${i.jiraKey ?? ""}`.toLowerCase().includes(t)));
  }, [all, types, owner, campaign, source, status, q]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    items.forEach((i) => spanDays(i.date, i.endDate).forEach((d) => m.set(d, [...(m.get(d) ?? []), i])));
    m.forEach((v) => v.sort(byTime));
    return m;
  }, [items]);

  const today = todayIso();
  const typeCount = (t: ItemType) => all.filter((i) => i.type === t).length;
  const toggleType = (t: ItemType) => setTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const problems = results.filter((r) => r.error);
  const noDateWarnings = results.flatMap((r) => r.warnings.map((w) => `${sources.find((s) => s.id === r.sourceId)?.name}: ${w}`));

  const label = view === "week" ? `${dayLabel(startOfWeek(cursor), { month: "short", day: "numeric" })} – ${dayLabel(addDays(startOfWeek(cursor), 6), { month: "short", day: "numeric", year: "numeric" })}` : monthLabel(cursor);
  const move = (dir: 1 | -1) => setCursor(view === "week" ? addDays(cursor, 7 * dir) : shiftMonth(cursor, dir));

  const open = (id: string) => setPanel({ kind: "item", id });
  const grid = monthGrid(cursor);
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
  const curMonth = fromIso(cursor).getMonth();

  const listDays = useMemo(() => {
    const days = [...new Set(items.map((i) => i.date))].sort();
    return days.map((d) => [d, items.filter((i) => i.date === d).sort(byTime)] as const);
  }, [items]);

  return (
    <main className="w-full p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-lg border border-control bg-white hover:bg-brand-soft"><span className="rotate-180"><Icon name="chevronRight" size={14} /></span></button>
          <button onClick={() => setCursor(todayIso())} className="rounded-lg border border-control bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-soft">Today</button>
          <button onClick={() => move(1)} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-lg border border-control bg-white hover:bg-brand-soft"><Icon name="chevronRight" size={14} /></button>
          <span className="ml-2 text-lg font-semibold">{label}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-control">
            {(["month", "week", "list"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-3 py-1.5 text-sm capitalize ${view === v ? "bg-brand text-n-50" : "bg-white hover:bg-brand-soft"}`}>{v}</button>
            ))}
          </div>
          <button onClick={load} aria-label="Reload sources" title="Reload sources" className="flex h-8 w-8 items-center justify-center rounded-lg border border-control bg-white hover:bg-brand-soft"><Icon name="refresh" size={16} /></button>
          <Link href="/calendar/sources" className="rounded-lg border border-control bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-soft">Sources ({sources.length})</Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ITEM_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => toggleType(t.id)}
            aria-pressed={types.has(t.id)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${types.has(t.id) ? "border-ink bg-ink text-n-50" : "border-control bg-white hover:bg-brand-soft"}`}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: TYPE_BAR[t.id] }} aria-hidden />
            {t.label} <span className="text-xs opacity-70">{typeCount(t.id)}</span>
          </button>
        ))}
        {types.size > 0 && <button onClick={() => setTypes(new Set())} className="text-sm text-brand hover:underline">Show all</button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label className="relative">
          <span className="sr-only">Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" className={`${sel} w-56 pl-8`} />
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"><Icon name="search" size={14} /></span>
        </label>
        <select aria-label="Owner" className={sel} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Any owner</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
        <select aria-label="Campaign" className={sel} value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="">Any campaign</option>{campaigns.map((o) => <option key={o}>{o}</option>)}</select>
        <select aria-label="Status" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{STATUSES.map((o) => <option key={o}>{o}</option>)}</select>
        <select aria-label="Source" className={sel} value={source} onChange={(e) => setSource(e.target.value)}><option value="">Any source</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <span className="ml-auto text-muted">{loading ? "Loading sources…" : `${items.length} of ${all.length} items`}</span>
      </div>

      {problems.length > 0 && (
        <div className="mb-3 space-y-2">
          {problems.map((p) => (
            <Callout key={p.sourceId} tone="bad" icon="alert">
              {sources.find((s) => s.id === p.sourceId)?.name}: {p.error}{" "}
              <Link href="/calendar/sources" className="underline">Fix source</Link>
            </Callout>
          ))}
        </div>
      )}
      {noDateWarnings.length > 0 && <p className="mb-3 text-xs text-muted">{noDateWarnings.join(" · ")}</p>}

      {view === "month" && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="grid grid-cols-7 border-b border-line bg-n-150 text-xs font-semibold text-n-800">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = fromIso(d).getMonth() === curMonth;
              return (
                <div key={d} className={`min-h-28 border-b border-r border-line p-1.5 ${inMonth ? "" : "bg-n-150/60"}`}>
                  <div className="mb-1 flex items-center">
                    <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${d === today ? "bg-brand font-bold text-n-50" : inMonth ? "font-medium" : "text-n-650"}`}>{fromIso(d).getDate()}</span>
                  </div>
                  <div className="space-y-1">
                    {list.slice(0, 3).map((i) => <Chip key={i.id + d} item={i} onOpen={() => open(i.id)} />)}
                    {list.length > 3 && <button onClick={() => setPanel({ kind: "day", day: d })} className="text-[11px] font-medium text-brand hover:underline">+{list.length - 3} more</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-7 gap-2">
          {week.map((d) => (
            <section key={d} className={`min-h-64 rounded-xl border bg-white p-2 ${d === today ? "border-brand" : "border-line"}`}>
              <header className="mb-2 flex items-baseline gap-1.5 text-sm"><b>{dayLabel(d, { weekday: "short" })}</b><span className="text-muted">{fromIso(d).getDate()}</span></header>
              <div className="space-y-2">
                {(byDay.get(d) ?? []).map((i) => (
                  <button key={i.id + d} onClick={() => open(i.id)} className="block w-full rounded-lg border border-line p-2 text-left text-xs hover:bg-brand-soft" style={{ borderLeft: `3px solid ${TYPE_BAR[i.type]}` }}>
                    <span className="mb-1 flex items-center gap-1.5"><Tag tone={TYPE_TONE[i.type]}>{TYPE_SHORT[i.type]}</Tag>{i.time != null && <span className="text-muted">{formatTime(i.time)}</span>}</span>
                    <span className="block font-medium">{i.title}</span>
                    {i.channel && <span className="text-muted">{i.channel}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {view === "list" && (
        <div className="space-y-5">
          {listDays.length === 0 && <p className="rounded-xl border border-dashed border-control bg-white/60 p-8 text-center text-sm text-muted">No items match these filters.</p>}
          {listDays.map(([d, list]) => (
            <section key={d}>
              <h2 className={`mb-2 text-sm font-semibold ${d === today ? "text-brand" : "text-n-800"}`}>{dayLabel(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{d === today && " · Today"}</h2>
              <ul className="space-y-1.5">
                {list.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => open(i.id)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 text-left text-sm hover:border-brand">
                      <Tag tone={TYPE_TONE[i.type]}>{TYPE_SHORT[i.type]}</Tag>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i.title}</span><span className="block truncate text-xs text-muted">{[i.channel, i.campaign, i.owner].filter(Boolean).join(" · ")}</span></span>
                      <span className="hidden text-xs text-muted sm:block">{i.sourceName}</span>
                      <Tag tone={STATUS_TONE[i.status]}>{i.status}</Tag>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ItemPanel
        panel={panel}
        items={all}
        dayItems={panel?.kind === "day" ? byDay.get(panel.day) ?? [] : []}
        onPick={open}
        onClose={() => setPanel(null)}
      />
    </main>
  );
}
