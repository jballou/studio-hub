"use client";

import { useEffect, useState } from "react";
import { Callout } from "@/components/ui/Tag";
import { isJira } from "@/lib/data/mode";

type Row = { at: string; actor: string; action: string; target: string; detail?: string };

const LABEL: Record<string, string> = {
  "user.add": "added", "user.update": "changed", "user.remove": "removed", "user.first_signin": "signed in for the first time",
  "block.create": "marked as blocked", "block.reassign": "changed who is blocking", "block.resolve": "cleared the block on",
  "flow.update": "edited", "flow.restore": "restored", "flow.reset": "reset",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function AdminActivity() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!isJira) return;
    fetch("/api/admin/audit?limit=300", { cache: "no-store" })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? `Couldn't load (${r.status}).`); setRows(b.entries); })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (!isJira) return <main className="page"><p className="text-sm text-muted">Activity appears once sign-in is turned on.</p></main>;
  const shown = (rows ?? []).filter((r) => `${r.actor} ${r.action} ${r.target} ${r.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="page">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold">Activity</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search activity" className="ml-auto w-56 rounded-lg border border-control bg-white px-4 py-2 text-sm" />
      </div>
      <p className="mb-4 text-sm text-muted">Who changed access or blocked work, newest first. The last 500 changes are kept.</p>
      {error && <Callout tone="bad" icon="alert">{error}</Callout>}
      {rows && shown.length === 0 && <p className="text-sm text-muted">Nothing matches.</p>}
      {rows && shown.length > 0 && (
        <ul className="divide-y divide-line card text-sm">
          {shown.map((a, i) => (
            <li key={i} className="flex flex-wrap gap-x-4 px-4 py-2">
              <span className="w-44 shrink-0 text-xs text-muted">{when(a.at)}</span>
              <span><b>{a.actor}</b> {LABEL[a.action] ?? a.action} <b>{a.target}</b>{a.detail ? ` (${a.detail})` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
