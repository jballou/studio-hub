"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { formatTime } from "@/lib/calendar/csv";
import { addDays, dayLabel, fromIso, monthGrid, monthLabel, shiftMonth, spanDays, startOfWeek, todayIso } from "@/lib/calendar/dates";
import { loadSource, loadSources } from "@/lib/calendar/store";
import { isJira, projectsRepo, tasksRepo } from "@/lib/data";
import { MY_TASKS_SOURCE, tasksResult } from "@/lib/calendar/tasks";
import { ITEM_TYPES, STATUSES, type CalendarItem, type CalendarSource, type ItemType, type SourceResult } from "@/lib/calendar/types";
import { ItemPanel } from "./ItemPanel";
import { STATUS_TONE, TYPE_BAR, TYPE_SHORT, TYPE_TONE } from "./meta";

type View = "month" | "week" | "list";
type Panel = { kind: "item"; id: string } | { kind: "day"; day: string } | null;

const byTime = (a: CalendarItem, b: CalendarItem) => (a.time ?? 1e9) - (b.time ?? 1e9) || a.title.localeCompare(b.title);
const sel = "rounded-tight border border-control bg-white px-2 py-2 text-sm";
const iconBtn = "relative flex h-8 w-8 items-center justify-center rounded-tight border border-control bg-white hover:bg-n-150";
const badge = "absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-round bg-brand px-2 text-xs font-bold text-n-50";

function Pill({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-round border border-control bg-white py-0 pl-4 pr-2">
      {children}
      <button onClick={onRemove} aria-label="Remove filter" className="flex h-5 w-5 items-center justify-center rounded-round hover:bg-n-150"><Icon name="x" size={12} /></button>
    </span>
  );
}

function Chip({ item, onOpen }: { item: CalendarItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title={`${TYPE_SHORT[item.type]}: ${item.title}`}
      className="flex w-full items-center gap-2 truncate rounded-tight border border-line bg-white py-0 pl-2 pr-2 text-left text-xs hover:bg-n-150"
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
  const [projectKeys, setProjectKeys] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<"tags" | "filter" | "more" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const barRef = useRef<HTMLDivElement>(null);

  // Close any open popover on outside click or Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!barRef.current?.contains(e.target as Node)) setMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menu]);

  // Everything loads once. A task change only re-reads the tasks, never the Jira and sheet sources.
  const load = useCallback(async () => {
    setLoading(true);
    // Demo mode links to projects it knows; with real Jira every MKTGCRTV ticket has a page here, so no lookup is needed.
    if (!isJira) projectsRepo.listProjects("u-avery").then((ps) => setProjectKeys(new Set(ps.map((p) => p.jiraKey))));
    const srcs = loadSources();
    setSources([...srcs, MY_TASKS_SOURCE]);
    const [loaded, mine] = await Promise.all([
      Promise.all(srcs.map(loadSource)),
      tasksRepo.list().then((s) => tasksResult(s.tasks)).catch(() => tasksResult([])),
    ]);
    setResults([...loaded, mine]);
    setLoading(false);
  }, []);

  const reloadTasks = useCallback(async () => {
    const mine = await tasksRepo.list().then((s) => tasksResult(s.tasks)).catch(() => tasksResult([]));
    setResults((cur) => [...cur.filter((r) => r.sourceId !== MY_TASKS_SOURCE.id), mine]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Tasks added or ticked off on My Day show up here without a reload.
    window.addEventListener("tasks-changed", reloadTasks);
    return () => window.removeEventListener("tasks-changed", reloadTasks);
  }, [load, reloadTasks]);

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
  const otherFilters = [owner, campaign, status, source].filter(Boolean).length;
  const clearAll = () => { setTypes(new Set()); setOwner(""); setCampaign(""); setStatus(""); setSource(""); };
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

  // List view: months (newest first unless flipped), each with its days in the same direction.
  const listMonths = useMemo(() => {
    const dir = order === "newest" ? -1 : 1;
    const days = [...new Set(items.map((i) => i.date))].sort((a, b) => dir * a.localeCompare(b));
    const months: { key: string; days: (readonly [string, CalendarItem[]])[]; count: number }[] = [];
    for (const d of days) {
      const key = d.slice(0, 7);
      let m = months[months.length - 1];
      if (m?.key !== key) { m = { key, days: [], count: 0 }; months.push(m); }
      const list = items.filter((i) => i.date === d).sort(byTime);
      m.days.push([d, list] as const);
      m.count += list.length;
    }
    return months;
  }, [items, order]);
  const toggleMonth = (key: string) => setFolded((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const allFolded = listMonths.length > 0 && listMonths.every((m) => folded.has(m.key));
  useEffect(() => {
    try { const v = localStorage.getItem("calendar-order"); // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "oldest" || v === "newest") setOrder(v); } catch { /* storage unavailable */ }
  }, []);
  const flip = () => { const next = order === "newest" ? "oldest" : "newest"; setOrder(next); try { localStorage.setItem("calendar-order", next); } catch { /* ignore */ } };

  return (
    <main className="page">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} aria-label="Previous" className={iconBtn}><span className="rotate-180"><Icon name="chevronRight" size={14} /></span></button>
          <button onClick={() => setCursor(todayIso())} className="btn btn-md btn-secondary">Today</button>
          <button onClick={() => move(1)} aria-label="Next" className={iconBtn}><Icon name="chevronRight" size={14} /></button>
          <span className="ml-2 text-lg font-bold">{label}</span>
        </div>

        <div className="ml-auto flex items-center gap-2" ref={barRef}>
          {searchOpen || q ? (
            <label className="relative">
              <span className="sr-only">Search items</span>
              <input
                autoFocus={searchOpen}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); setSearchOpen(false); } }}
                onBlur={() => !q && setSearchOpen(false)}
                placeholder="Search items"
                className="w-52 rounded-tight border border-control bg-white py-2 pl-8 pr-8 text-sm"
              />
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"><Icon name="search" size={14} /></span>
              {q && <button onClick={() => { setQ(""); setSearchOpen(false); }} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2"><Icon name="x" size={14} /></button>}
            </label>
          ) : (
            <button onClick={() => setSearchOpen(true)} aria-label="Search" title="Search" className={iconBtn}><Icon name="search" size={16} /></button>
          )}

          <div className="relative">
            <button onClick={() => setMenu(menu === "tags" ? null : "tags")} aria-label="Filter by type" aria-expanded={menu === "tags"} title="Types" className={`${iconBtn} ${types.size ? "border-brand bg-brand-soft" : ""}`}>
              <Icon name="tag" size={16} />
              {types.size > 0 && <span className={badge}>{types.size}</span>}
            </button>
            {menu === "tags" && (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-loose border border-line bg-white p-2 shadow-lg">
                {ITEM_TYPES.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-tight px-2 py-2 text-sm hover:bg-n-150">
                    <input type="checkbox" checked={types.has(t.id)} onChange={() => toggleType(t.id)} />
                    <span className="h-2.5 w-2.5 rounded-round" style={{ background: TYPE_BAR[t.id] }} aria-hidden />
                    <span className="flex-1">{t.label}</span>
                    <span className="text-xs text-muted">{typeCount(t.id)}</span>
                  </label>
                ))}
                {types.size > 0 && <button onClick={() => setTypes(new Set())} className="mt-2 w-full rounded-tight px-2 py-2 text-left text-sm font-medium text-brand hover:bg-n-150">Show all types</button>}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setMenu(menu === "filter" ? null : "filter")} aria-label="Filters" aria-expanded={menu === "filter"} title="Filters" className={`${iconBtn} ${otherFilters ? "border-brand bg-brand-soft" : ""}`}>
              <Icon name="filter" size={16} />
              {otherFilters > 0 && <span className={badge}>{otherFilters}</span>}
            </button>
            {menu === "filter" && (
              <div className="absolute right-0 top-full z-20 mt-2 w-72 space-y-4 rounded-loose border border-line bg-white p-4 shadow-lg">
                <label className="block text-xs font-bold">Owner<select className={`${sel} mt-2 w-full font-normal`} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Any owner</option>{owners.map((o) => <option key={o}>{o}</option>)}</select></label>
                <label className="block text-xs font-bold">Campaign<select className={`${sel} mt-2 w-full font-normal`} value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="">Any campaign</option>{campaigns.map((o) => <option key={o}>{o}</option>)}</select></label>
                <label className="block text-xs font-bold">Status<select className={`${sel} mt-2 w-full font-normal`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{STATUSES.map((o) => <option key={o}>{o}</option>)}</select></label>
                <label className="block text-xs font-bold">Source<select className={`${sel} mt-2 w-full font-normal`} value={source} onChange={(e) => setSource(e.target.value)}><option value="">Any source</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                {otherFilters > 0 && <button onClick={() => { setOwner(""); setCampaign(""); setStatus(""); setSource(""); }} className="text-sm font-medium text-brand hover:underline">Clear filters</button>}
              </div>
            )}
          </div>

          <div className="seg">
            {([["month", "Month", "calendarDays"], ["week", "Week", "calendarWeek"], ["list", "List", "listStart"]] as const).map(([v, label, icon]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="seg-item"><Icon name={icon} size={14} />{label}</button>
            ))}
          </div>

          <div className="relative">
            <button onClick={() => setMenu(menu === "more" ? null : "more")} aria-label="More options" aria-expanded={menu === "more"} className={iconBtn}><Icon name="more" size={16} /></button>
            {menu === "more" && (
              <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-loose border border-line bg-white p-2 text-sm shadow-lg">
                <button onClick={() => { load(); setMenu(null); }} className="flex w-full items-center gap-2 rounded-tight px-4 py-2 text-left hover:bg-n-150"><Icon name="refresh" size={14} /> Reload sources</button>
                <Link href="/calendar/sources" className="flex w-full items-center gap-2 rounded-tight px-4 py-2 hover:bg-n-150"><Icon name="link" size={14} /> Sources ({sources.length})</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {(types.size > 0 || owner || campaign || status || source) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {[...types].map((t) => <Pill key={t} onRemove={() => toggleType(t)}>{ITEM_TYPES.find((x) => x.id === t)?.label}</Pill>)}
          {owner && <Pill onRemove={() => setOwner("")}>Owner: {owner}</Pill>}
          {campaign && <Pill onRemove={() => setCampaign("")}>Campaign: {campaign}</Pill>}
          {status && <Pill onRemove={() => setStatus("")}>{status}</Pill>}
          {source && <Pill onRemove={() => setSource("")}>{sources.find((s) => s.id === source)?.name}</Pill>}
          <button onClick={clearAll} className="font-medium text-brand hover:underline">Clear all</button>
          <span className="ml-auto text-muted">{loading ? "Loading…" : `${items.length} of ${all.length} items`}</span>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mb-4 space-y-2">
          {problems.map((p) => (
            <Callout key={p.sourceId} tone="bad" icon="alert">
              {sources.find((s) => s.id === p.sourceId)?.name}: {p.error}{" "}
              <Link href="/calendar/sources" className="underline">Fix source</Link>
            </Callout>
          ))}
        </div>
      )}
      {noDateWarnings.length > 0 && <p className="mb-4 text-xs text-muted">{noDateWarnings.join(" · ")}</p>}

      {view === "month" && (
        <div className="overflow-hidden rounded-loose border border-line bg-white">
          <div className="grid grid-cols-7 border-b border-line bg-n-150 text-xs font-bold text-n-800">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = fromIso(d).getMonth() === curMonth;
              return (
                <div key={d} className={`min-h-28 border-b border-r border-line p-2 ${inMonth ? "" : "bg-n-150/60"}`}>
                  <div className="mb-2 flex items-center">
                    <span className={`flex h-6 min-w-6 items-center justify-center rounded-round px-2 text-xs ${d === today ? "bg-brand font-bold text-n-50" : inMonth ? "font-medium" : "text-n-650"}`}>{fromIso(d).getDate()}</span>
                  </div>
                  <div className="space-y-2">
                    {list.slice(0, 3).map((i) => <Chip key={i.id + d} item={i} onOpen={() => open(i.id)} />)}
                    {list.length > 3 && <button onClick={() => setPanel({ kind: "day", day: d })} className="text-xs font-medium text-brand hover:underline">+{list.length - 3} more</button>}
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
            <section key={d} className={`min-h-64 rounded-tight border bg-white p-2 ${d === today ? "border-brand" : "border-line"}`}>
              <header className="mb-2 flex items-baseline gap-2 text-sm"><b>{dayLabel(d, { weekday: "short" })}</b><span className="text-muted">{fromIso(d).getDate()}</span></header>
              <div className="space-y-2">
                {(byDay.get(d) ?? []).map((i) => (
                  <button key={i.id + d} onClick={() => open(i.id)} className="block w-full rounded-tight border border-line p-2 text-left text-xs hover:bg-n-150" style={{ borderLeft: `3px solid ${TYPE_BAR[i.type]}` }}>
                    <span className="mb-2 flex items-center gap-2"><Tag tone={TYPE_TONE[i.type]}>{TYPE_SHORT[i.type]}</Tag>{i.time != null && <span className="text-muted">{formatTime(i.time)}</span>}</span>
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
        <div className="space-y-6">
          <div className="flex items-center justify-end gap-2">
            <button onClick={flip} aria-label={`Order: ${order} first. Click to reverse.`} title={order === "newest" ? "Newest first. Click to reverse" : "Oldest first. Click to reverse"} className="btn btn-icon btn-secondary">
              <span className={order === "oldest" ? "rotate-180" : ""}><Icon name="arrowDown" size={16} /></span>
            </button>
            <button onClick={() => setFolded(allFolded ? new Set() : new Set(listMonths.map((m) => m.key)))} aria-label={allFolded ? "Expand all months" : "Collapse all months"} title={allFolded ? "Expand all" : "Collapse all"} className="btn btn-icon btn-secondary">
              <Icon name={allFolded ? "chevronsUpDown" : "chevronsDownUp"} size={16} />
            </button>
          </div>
          {listMonths.length === 0 && <p className="rounded-loose border border-dashed border-control bg-white/60 p-8 text-center text-sm text-muted">No items match these filters.</p>}
          {listMonths.map((m) => {
            const expanded = !folded.has(m.key);
            const isNow = m.key === today.slice(0, 7);
            return (
              <section key={m.key} aria-label={dayLabel(`${m.key}-01`, { month: "long", year: "numeric" })}>
                <h2>
                  <button onClick={() => toggleMonth(m.key)} aria-expanded={expanded} className="flex w-full items-center gap-2 border-b border-line pb-2 text-left">
                    <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}><Icon name="chevronRight" size={16} /></span>
                    <span className={`text-lg font-bold ${isNow ? "text-brand" : ""}`}>{dayLabel(`${m.key}-01`, { month: "long", year: "numeric" })}</span>
                    {isNow && <Tag tone="ok">This month</Tag>}
                    <span className="ml-auto text-sm font-normal text-muted">{m.count} {m.count === 1 ? "item" : "items"}</span>
                  </button>
                </h2>
                {expanded && (
                  <div className="mt-4 space-y-6">
                    {m.days.map(([d, list]) => (
                      <div key={d}>
                        <h3 className={`mb-2 text-sm font-bold ${d === today ? "text-brand" : "text-n-800"}`}>{dayLabel(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{d === today && " · Today"}</h3>
                        <ul className="space-y-2">
                          {list.map((i) => (
                            <li key={i.id}>
                              <button onClick={() => open(i.id)} className="flex w-full items-center gap-4 card px-4 py-2 text-left text-sm hover:border-brand">
                                <Tag tone={TYPE_TONE[i.type]}>{TYPE_SHORT[i.type]}</Tag>
                                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i.title}</span><span className="block truncate text-xs text-muted">{[i.channel, i.campaign, i.owner].filter(Boolean).join(" · ")}</span></span>
                                <span className="hidden text-xs text-muted sm:block">{i.sourceName}</span>
                                <Tag tone={STATUS_TONE[i.status]}>{i.status}</Tag>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <ItemPanel
        panel={panel}
        items={all}
        dayItems={panel?.kind === "day" ? byDay.get(panel.day) ?? [] : []}
        hasProject={(k) => (isJira ? k.startsWith("MKTGCRTV-") : projectKeys.has(k))}
        onPick={open}
        onClose={() => setPanel(null)}
      />
    </main>
  );
}
