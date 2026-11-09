"use client";

import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Callout, Tag } from "@/components/ui/Tag";
import { isJira } from "@/lib/data/mode";
import type { OkrConfig, OkrMirror } from "@/lib/okr/types";

type Overview = { config: OkrConfig; mirror: OkrMirror | null; google: { configured: boolean; connected: boolean; canReadSheets: boolean } };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function AdminOkr() {
  const [data, setData] = useState<Overview | null>(null);
  const [sheet, setSheet] = useState("");
  const [tabs, setTabs] = useState("");
  const [busy, setBusy] = useState<"save" | "sync" | "sample" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const apply = (d: Overview) => {
    setData(d);
    setSheet(d.config.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${d.config.spreadsheetId}` : "");
    setTabs(d.config.tabs.join(", "));
  };

  const call = useCallback(async (method: "GET" | "PUT" | "POST", body?: unknown) => {
    const r = await fetch("/api/admin/okr", { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error ?? `Something went wrong (${r.status}).`);
    return b as Overview;
  }, []);

  useEffect(() => {
    if (!isJira) return;
    call("GET").then(apply).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }, [call]);

  if (!isJira) return <main className="page [&>*:not(.fixed)]:max-w-3xl"><p className="text-sm text-muted">OKRs appear once sign-in is turned on.</p></main>;

  const run = async (kind: "save" | "sync" | "sample") => {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      if (kind === "save") {
        apply(await call("PUT", { sheet, tabs: tabs.split(",").map((t) => t.trim()).filter(Boolean) }));
        setNote("Saved. Sync to pull the latest.");
      } else if (kind === "sample") {
        apply(await call("POST", { sample: true }));
        setNote("Loaded sample data. Nothing from the real Sheet was imported.");
      } else {
        const d = await call("POST");
        apply(d);
        setNote(`Synced ${d.mirror?.krs.length ?? 0} KRs and ${d.mirror?.initiatives.length ?? 0} initiatives.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't finish that.");
    }
    setBusy(null);
  };

  const m = data?.mirror;
  const g = data?.google;

  return (
    <main className="page [&>*:not(.fixed)]:max-w-3xl">
      <PageTitle>OKRs</PageTitle>
      <p className="mb-6 text-sm text-muted">A read-only copy of the FY27 OKR Sheet, so creatives can tie projects and reports to a KR. The Sheet stays the source of truth; edit it there and sync here.</p>

      {data?.mirror?.sample && (
        <div className="mb-4">
          <Callout tone="warn" icon="alert">Currently using sample data. Nothing from the real OKR Sheet has been imported. Projects tagged now point at sample KRs and will need re-tagging after the real sync.</Callout>
        </div>
      )}
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
      {note && <div className="mb-4"><Callout tone="ok" icon="check">{note}</Callout></div>}

      <section className="card mb-4 p-6" aria-labelledby="source">
        <h2 id="source" className="text-lg font-bold">Source</h2>
        <label className="mt-4 block text-sm font-bold">Google Sheet link
          <input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className="mt-2 block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal" />
        </label>
        <label className="mt-4 block text-sm font-bold">Tabs to read
          <input value={tabs} onChange={(e) => setTabs(e.target.value)} className="mt-2 block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal" />
          <span className="mt-2 block text-xs font-normal text-muted">Exact tab names, separated by commas. Start with Marketing.</span>
        </label>
        <div className="mt-4"><button onClick={() => run("save")} disabled={!sheet.trim() || busy !== null} className="btn btn-md btn-primary">{busy === "save" ? "Saving…" : "Save"}</button></div>
      </section>

      <section className="card mb-4 p-6" aria-labelledby="sync">
        <h2 id="sync" className="text-lg font-bold">Sync</h2>
        {g && !g.configured && <p className="mt-2 text-sm text-muted">Google isn&apos;t set up for this app yet. See docs/google-setup.md.</p>}
        {g?.configured && !g.canReadSheets && (
          <>
            <p className="mb-4 mt-2 text-sm text-muted">Syncing uses your own Google account. Allow read-only access to Google Sheets once; nobody else is asked for this.</p>
            <a href="/api/google/connect?sheets=1" className="btn btn-md btn-secondary">Connect Google Sheets</a>
          </>
        )}
        {g?.canReadSheets && (
          <div className="mt-4 flex items-center gap-4">
            <button onClick={() => run("sync")} disabled={!data?.config.spreadsheetId || busy !== null} className="btn btn-md btn-primary">{busy === "sync" ? "Syncing…" : "Sync now"}</button>
            <Tag tone="ok" icon="check">Sheets access on</Tag>
          </div>
        )}
        {(!m || m.sample) && (
          <div className="mt-4">
            <button onClick={() => run("sample")} disabled={busy !== null} className="btn btn-md btn-secondary">{busy === "sample" ? "Loading…" : m?.sample ? "Reload sample data" : "Load sample data"}</button>
            <p className="mt-2 text-xs text-muted">Made-up goals shaped like the real Sheet, for trying the picker and reports without importing anything.</p>
          </div>
        )}
        {m ? (
          <p className="mt-4 text-sm text-muted">{m.sample ? "Sample data loaded" : "Last synced"} {when(m.syncedAt)}{m.sample ? "" : ` by ${m.syncedBy}`}. {m.krs.length} KRs, {m.initiatives.length} initiatives.</p>
        ) : (
          <p className="mt-4 text-sm text-muted">Not synced yet.</p>
        )}
        {m && m.warnings.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold">Needs a look in the Sheet</p>
            <ul className="space-y-2 text-sm text-muted">{m.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
      </section>

      {m && m.krs.length > 0 && (
        <section className="card p-6" aria-labelledby="krs">
          <h2 id="krs" className="mb-4 text-lg font-bold">Key results</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted"><tr><th className="pb-2 pr-4 font-medium">Objective</th><th className="pb-2 pr-4 font-medium">KR</th><th className="pb-2 pr-4 font-medium">Baseline</th><th className="pb-2 pr-4 font-medium">Current</th><th className="pb-2 font-medium">Target</th></tr></thead>
              <tbody>
                {m.krs.slice(0, 100).map((k) => (
                  <tr key={k.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4">{k.objective}</td><td className="py-2 pr-4">{k.kr}</td>
                    <td className="py-2 pr-4">{k.baseline ?? "–"}</td><td className="py-2 pr-4">{k.current ?? "–"}</td><td className="py-2">{k.target ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
