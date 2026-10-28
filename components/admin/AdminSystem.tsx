"use client";

import { useCallback, useEffect, useState } from "react";
import { Callout, Tag } from "@/components/ui/Tag";
import { isJira } from "@/lib/data/mode";

type Check = { id: string; label: string; ok: boolean; detail: string };
type Result = { checks: Check[]; build: { env: string; commit: string | null; site: string | null } };

export function AdminSystem() {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/system", { cache: "no-store" });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? `Couldn't load (${r.status}).`);
      setData(b);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isJira) load();
  }, [load]);

  if (!isJira) return <main className="mx-auto w-full max-w-3xl p-6"><p className="text-sm text-muted">System status appears once sign-in is turned on.</p></main>;

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold">System</h1>
        <button onClick={load} disabled={loading} className="ml-auto rounded-lg border border-control bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-40">{loading ? "Checking…" : "Re-check"}</button>
      </div>
      <p className="mb-4 text-sm text-muted">Is everything the app depends on connected? Shows names and counts only, never secret values. Useful when handing this over.</p>
      {error && <Callout tone="bad" icon="alert">{error}</Callout>}
      <ul className="space-y-2">
        {data?.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-4 rounded-xl border border-line bg-white p-4">
            <Tag tone={c.ok ? "ok" : "bad"} icon={c.ok ? "check" : "close"}>{c.ok ? "OK" : "Check"}</Tag>
            <div><p className="text-sm font-medium">{c.label}</p><p className="text-xs text-muted">{c.detail}</p></div>
          </li>
        ))}
      </ul>
      {data && (
        <dl className="mt-6 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Environment</dt><dd>{data.build.env}</dd>
          <dt className="text-muted">Version</dt><dd className="font-mono text-xs">{data.build.commit ?? "local"}</dd>
          <dt className="text-muted">Jira site</dt><dd>{data.build.site ?? "Not set"}</dd>
        </dl>
      )}
      <p className="mt-6 text-xs text-muted">Handing this over? See <code>docs/HANDOFF.md</code> in the repository for accounts, owners and settings to transfer.</p>
    </main>
  );
}
