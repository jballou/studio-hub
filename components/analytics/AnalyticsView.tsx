"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Callout, Tag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { StaleNotice } from "@/components/ui/StaleNotice";
import { projectsRepo } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import { byIssueType, byPerson, byProjectType, daysLabel, groupStats, percentLabel, summarize, type Stats } from "@/lib/analytics";
import { needsStartDate } from "@/lib/startdate";
import type { Project } from "@/lib/types";

type Scope = "you" | "team";
type Cut = "issue" | "project" | "person";
const RANGES = [{ id: 90, label: "Last 90 days" }, { id: 180, label: "Last 6 months" }, { id: 365, label: "Last year" }] as const;

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className="flex h-full flex-col items-start card p-4">
      <div className="text-sm font-bold">{label}</div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${tone === "warn" ? "text-warn-fg" : ""}`}>{value}</div>
      <div className="mt-2 text-xs text-muted">{note}</div>
    </div>
  );
}

/** A number with a bar under it. The number is always there, so the bar is never the only signal. */
function Bar({ value, max, label, color }: { value: number | null; max: number; label: string; color: string }) {
  return (
    <div className="min-w-32">
      <div className="text-sm font-medium tabular-nums">{label}</div>
      <div className="mt-2 h-2 rounded-round bg-n-150" aria-hidden="true">
        {value !== null && max > 0 && <div className="h-2 rounded-round" style={{ width: `${Math.max(4, (value / max) * 100)}%`, background: color }} />}
      </div>
    </div>
  );
}

function Breakdown({ rows, heading }: { rows: Stats[]; heading: string }) {
  const maxOpen = Math.max(0, ...rows.map((r) => r.openAvg ?? 0));
  const maxWork = Math.max(0, ...rows.map((r) => r.workAvg ?? 0));
  if (rows.length === 0) return <p className="rounded-loose border border-dashed border-control p-8 text-center text-sm text-muted">No closed tickets in this period.</p>;
  return (
    <div className="overflow-x-auto card">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line bg-n-100 text-xs font-bold text-muted">
          <tr>
            <th scope="col" className="p-4">{heading}</th>
            <th scope="col" className="p-4">Closed</th>
            <th scope="col" className="p-4">Time open <span className="font-normal">(created to closed)</span></th>
            <th scope="col" className="p-4">Real work <span className="font-normal">(start date to closed)</span></th>
            <th scope="col" className="p-4">Have a start date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="p-4 font-medium">{r.label}</th>
              <td className="p-4 tabular-nums">{r.n}</td>
              <td className="p-4"><Bar value={r.openAvg} max={maxOpen} label={`${daysLabel(r.openAvg)} avg`} color="var(--color-n-650)" /></td>
              <td className="p-4">
                <Bar value={r.workAvg} max={maxWork} label={r.workN ? `${daysLabel(r.workAvg)} avg` : "No start dates"} color="var(--color-brand)" />
                {r.workN > 0 && <div className="mt-2 text-xs text-muted">from {r.workN} {r.workN === 1 ? "ticket" : "tickets"}</div>}
              </td>
              <td className="p-4"><Tag tone={r.coverage === null ? "neutral" : r.coverage >= 0.8 ? "ok" : r.coverage >= 0.5 ? "warn" : "bad"} icon={r.coverage !== null && r.coverage >= 0.8 ? "check" : "alert"}>{percentLabel(r.coverage)}</Tag></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How long tickets stay open and how long the work really takes, for you and for the team. */
export function AnalyticsView() {
  const me = useMe();
  const [scope, setScope] = useState<Scope>("you");
  const [cut, setCut] = useState<Cut>("issue");
  const [range, setRange] = useState<number>(180);
  const [closed, setClosed] = useState<Project[] | null>(null);
  const [open, setOpen] = useState<Project[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me || me.role !== "creative") return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClosed(null);
    Promise.all([projectsRepo.closedWork(range), projectsRepo.listProjects(me.id, "all", "open", 100)])
      .then(([c, o]) => { if (live) { setClosed(c.projects); setTruncated(c.truncated); setOpen(o); setError(""); } })
      .catch((e: Error) => { if (live) { setClosed([]); setError(e.message); } });
    return () => { live = false; };
  }, [me, range]);

  const mine = (p: Project) => scope === "team" || p.assigneeId === me?.id;
  const closedShown = useMemo(() => (closed ?? []).filter(mine), [closed, scope, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const openShown = useMemo(() => open.filter((p) => p.group !== "closed").filter(mine), [open, scope, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => summarize("All", closedShown), [closedShown]);
  const rows = useMemo(() => groupStats(closedShown, cut === "issue" ? byIssueType : cut === "project" ? byProjectType : byPerson), [closedShown, cut]);
  const missing = openShown.filter(needsStartDate);

  if (me && me.role !== "creative") return <main className="page [&>*:not(.fixed)]:max-w-3xl"><Callout tone="info" icon="alert">Analytics is for the creative team.</Callout></main>;

  return (
    <main className="page">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted">How long tickets stay open, and how long the work itself takes.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Whose work" className="seg">
            {(["you", "team"] as const).map((s) => (
              <button key={s} onClick={() => { setScope(s); if (s === "you" && cut === "person") setCut("issue"); }} aria-pressed={scope === s} className="seg-item"><Icon name={s === "you" ? "userRound" : "usersRound"} size={14} />{s === "you" ? "You" : "Team"}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="range">Period</label>
          <select id="range" value={range} onChange={(e) => setRange(Number(e.target.value))} className="rounded-tight border border-control bg-white px-4 py-2 text-sm">
            {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4"><StaleNotice /></div>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      {closed === null ? <p className="text-sm text-muted">Loading…</p> : (
        <>
          {all.n > 0 && all.coverage !== null && all.coverage < 0.8 && (
            <div className="mb-4">
              <Callout tone="warn" icon="calendarDays">
                Only {percentLabel(all.coverage)} of the {all.n} tickets closed in this period had a start date, so real-work time is based on {all.workN} of them. The more tickets have a start date, the more reliable it gets. <Link href="/my-day" className="font-bold underline">Plan work in My Day</Link>.
              </Callout>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label="Closed" value={String(all.n)} note={scope === "you" ? "Assigned to you" : "By the whole team"} />
            <Tile label="Average time open" value={daysLabel(all.openAvg)} note={all.openMedian === null ? "Created to closed" : `Created to closed · typical ${daysLabel(all.openMedian)}`} />
            <Tile label="Average real work" value={daysLabel(all.workAvg)} note={all.workN ? `Start date to closed · ${all.workN} ${all.workN === 1 ? "ticket" : "tickets"}` : "No tickets with a start date yet"} />
            <Tile label="Open without a start date" value={String(missing.length)} note={`Of ${openShown.length} open ${openShown.length === 1 ? "ticket" : "tickets"}`} tone={missing.length ? "warn" : undefined} />
          </div>

          <section className="mt-6" aria-labelledby="by-h">
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <h2 id="by-h" className="text-lg font-bold">Breakdown</h2>
              <div role="tablist" aria-label="Group by" className="flex flex-wrap gap-2">
                {([["issue", "Ticket type"], ["project", "Project type"], ...(scope === "team" ? [["person", "Person"]] : [])] as [Cut, string][]).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={cut === id} onClick={() => setCut(id)} className="chip">{label}</button>
                ))}
              </div>
            </div>
            <Breakdown rows={rows} heading={cut === "issue" ? "Ticket type" : cut === "project" ? "Project type" : "Person"} />
            {truncated && <p className="mt-2 text-xs text-muted">Showing the 500 most recently closed tickets in this period.</p>}
            <p className="mt-2 text-xs text-muted">Calendar days. &quot;Time open&quot; runs from when the ticket was created to when it was resolved. &quot;Real work&quot; runs from its Start date to when it was resolved, and only counts tickets that have a Start date.</p>
          </section>

          {missing.length > 0 && (
            <section className="mt-6 rounded-loose border border-warn-line bg-white p-4" aria-labelledby="miss-h">
              <h2 id="miss-h" className="mb-4 text-lg font-bold">Open work without a start date</h2>
              <ul className="divide-y divide-line">
                {missing.slice(0, 10).map((p) => (
                  <li key={p.jiraKey} className="flex flex-wrap items-center gap-4 py-2 text-sm">
                    <Link href={`/projects/${p.jiraKey}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{p.title}</Link>
                    <span className="font-mono text-xs text-muted">{p.jiraKey}</span>
                    <span className="text-xs text-muted">{p.assigneeName ?? "Unassigned"}</span>
                  </li>
                ))}
              </ul>
              {missing.length > 10 && <p className="mt-2 text-xs text-muted">and {missing.length - 10} more</p>}
              <p className="mt-4 text-xs text-muted">{scope === "you" ? "Set these from Plan work in My Day." : "Each person sees their own list in Plan work on My Day."}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
