"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { isJira } from "@/lib/data/mode";
import { toCsvExportUrl } from "@/lib/calendar/gsheet";
import { loadSource, loadSources, saveUserSources } from "@/lib/calendar/store";
import { ITEM_TYPES, type CalendarSource, type ItemType, type SourceResult } from "@/lib/calendar/types";

const field = "w-full rounded-lg border border-control bg-white px-3 py-2 text-sm";

export function SourcesView() {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [results, setResults] = useState<Record<string, SourceResult>>({});
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [csv, setCsv] = useState("");
  const [type, setType] = useState<ItemType>("social");
  const [preview, setPreview] = useState<SourceResult | null>(null);
  const [testing, setTesting] = useState(false);

  const reload = useCallback(async () => {
    const srcs = loadSources();
    setSources(srcs);
    const rs = await Promise.all(srcs.map(loadSource));
    setResults(Object.fromEntries(rs.map((r) => [r.sourceId, r])));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const draft = (): CalendarSource => ({
    id: `sheet-${Date.now().toString(36)}`, name: name.trim() || "Untitled sheet", kind: "sheet", defaultType: type,
    url: csv.trim() ? undefined : url.trim(), csv: csv.trim() || undefined,
  });
  const urlProblem = url.trim() && !csv.trim() && !toCsvExportUrl(url) ? "That isn't a Google Sheets link." : null;
  const canTest = (csv.trim() || (url.trim() && !urlProblem)) && !testing;

  const test = async () => {
    setTesting(true);
    setPreview(await loadSource(draft()));
    setTesting(false);
  };

  const add = () => {
    const src = draft();
    const next = [...sources.filter((s) => !s.builtin), src];
    if (!saveUserSources(next)) { setPreview({ sourceId: src.id, items: [], warnings: [], error: "Couldn't save: browser storage is full or blocked.", loadedAt: "" }); return; }
    setName(""); setUrl(""); setCsv(""); setPreview(null);
    reload();
  };

  const remove = (id: string) => {
    saveUserSources(sources.filter((s) => !s.builtin && s.id !== id));
    reload();
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Link href="/calendar" className="mb-2 inline-block text-sm font-medium text-brand hover:underline">← Calendar</Link>
      <h1 className="text-2xl font-bold">Calendar sources</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Everything on the calendar comes from a source: a Google Sheet tracker or a Jira query. Add one and its dates show up for everyone.</p>

      <ul className="mb-8 space-y-2">
        {sources.map((s) => {
          const r = results[s.id];
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
              <Tag tone={s.kind === "jira" ? "info" : "ok"}>{s.kind === "jira" ? "Jira" : "Google Sheet"}</Tag>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.name}</span>
                <span className="block text-xs text-muted">
                  {!r ? "Loading…" : r.error ? <span className="text-bad-fg">{r.error}</span> : `${r.items.length} items${r.warnings.length ? ` · ${r.warnings.join(" ")}` : ""}`}
                </span>
              </span>
              {s.builtin ? <span className="text-xs text-muted">{isJira ? "Built in" : "Sample"}</span> : (
                <button onClick={() => remove(s.id)} className="text-xs font-medium text-bad-fg hover:underline">Remove</button>
              )}
            </li>
          );
        })}
      </ul>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Add a Google Sheet</h2>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">Name
            <input className={`${field} mt-1 font-normal`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2027 PR & events tracker" />
          </label>
          <label className="block text-sm font-semibold">Sheet link
            <input className={`${field} mt-1 font-normal`} value={url} onChange={(e) => { setUrl(e.target.value); setPreview(null); }} placeholder="https://docs.google.com/spreadsheets/d/…/edit?gid=0" />
            {urlProblem && <span role="alert" className="mt-1 block text-xs font-normal text-bad-fg">{urlProblem}</span>}
            <span className="mt-1 block text-xs font-normal text-muted">Open the tab you want, set sharing to “Anyone with the link can view”, and paste its link. The link includes the tab (gid).</span>
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Or paste CSV instead</summary>
            <textarea rows={4} className={`${field} mt-2 font-mono text-xs`} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} placeholder="Date,Title,Owner&#10;2026-11-03,Launch day,Sam" />
          </details>
          <label className="block text-sm font-semibold">What do the rows represent?
            <select className={`${field} mt-1 font-normal sm:w-1/2`} value={type} onChange={(e) => setType(e.target.value as ItemType)}>
              {ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">If the sheet has a Category column (PR, Event, Product launch…), that wins per row.</span>
          </label>
          <p className="text-xs text-muted">Columns are matched by header name. Needs a date and a title; owner, status, campaign, channel, notes, end date and Jira key are picked up when present.</p>

          <div className="flex items-center gap-2">
            <button onClick={test} disabled={!canTest} className="rounded-lg border border-control px-4 py-2 text-sm font-medium enabled:hover:bg-brand-soft disabled:opacity-40">{testing ? "Reading…" : "Test sheet"}</button>
            <button onClick={add} disabled={!preview || !!preview.error || preview.items.length === 0} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">Add source</button>
          </div>

          {preview?.error && <Callout tone="bad" icon="alert">{preview.error}</Callout>}
          {preview && !preview.error && (
            <div className="rounded-xl border border-ok-line bg-ok-bg p-3 text-sm text-ok-fg">
              <p className="flex items-center gap-1.5 font-medium"><Icon name="check" size={16} /> Found {preview.items.length} dated items</p>
              {preview.warnings.map((w) => <p key={w} className="mt-1 text-xs text-warn-fg">{w}</p>)}
              <ul className="mt-2 space-y-0.5 text-xs">
                {preview.items.slice(0, 5).map((i) => <li key={i.id}>{i.date} · {i.title}</li>)}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-dashed border-control bg-white/60 p-5">
        <h2 className="mb-1 text-lg font-semibold">Add a Jira query</h2>
        <p className="text-sm text-muted">Pull dates from tickets with a JQL filter and a date field (like Due date or a Launch date field). This turns on once Atlassian sign-in is connected. The MKTGCRTV source above shows what it will look like.</p>
      </section>
    </main>
  );
}
