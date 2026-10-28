"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { repo } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import type { Asset } from "@/lib/types";

type Item = Asset & { daysLeft: number };

const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

/** Deleted designs wait here for 30 days. The creative team can restore them; admins can also delete for good. */
export function AdminTrash() {
  const me = useMe();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ kind: "one"; item: Item } | { kind: "all" } | null>(null);

  const load = useCallback(() => {
    repo.listTrash().then((t) => { setItems(t); setError(""); }).catch((e: Error) => { setItems([]); setError(e.message); });
  }, []);
  useEffect(load, [load]);

  const restore = async (it: Item) => {
    setBusy(it.id); setError("");
    try { await repo.restoreAsset(it.id); setItems((cur) => (cur ?? []).filter((x) => x.id !== it.id)); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't restore that."); } finally { setBusy(null); }
  };
  const purge = async () => {
    if (!ask) return;
    setBusy("purge"); setError("");
    try {
      await repo.purgeTrash(ask.kind === "one" ? ask.item.id : undefined);
      setItems((cur) => (ask.kind === "one" ? (cur ?? []).filter((x) => x.id !== ask.item.id) : []));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete that."); } finally { setBusy(null); setAsk(null); }
  };

  return (
    <main className="page">
      <div className="mb-2 flex items-center gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Icon name="trash" size={22} /> Trash</h1>
        {me?.isAdmin && (items?.length ?? 0) > 0 && (
          <button onClick={() => setAsk({ kind: "all" })} className="ml-auto rounded-full border border-bad-line px-4 py-2 text-sm font-medium text-bad-fg hover:bg-bad-bg">Empty Trash</button>
        )}
      </div>
      <p className="mb-6 text-sm text-muted">Designs sent for review that someone deleted. Restore one and it comes back with its versions and comments. After 30 days in Trash, items are removed for good.</p>
      {error && <p role="alert" className="mb-4 rounded-lg border border-bad-line bg-bad-bg px-4 py-2 text-sm text-bad-fg">{error}</p>}

      {items === null ? <p className="text-sm text-muted">Loading…</p> : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-control p-10 text-center text-sm text-muted">Trash is empty.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.name}</span>
                <span className="block truncate text-xs text-muted">
                  <span className="font-mono">{it.projectKey}</span> · {it.versionIds.length} version{it.versionIds.length === 1 ? "" : "s"} · deleted {when(it.deletedAt)}{it.deletedBy ? ` by ${it.deletedBy.name}` : ""}
                </span>
              </span>
              <Tag tone={it.daysLeft <= 3 ? "warn" : "neutral"} icon={it.daysLeft <= 3 ? "alert" : undefined}>{it.daysLeft === 0 ? "Removed today" : `${it.daysLeft} day${it.daysLeft === 1 ? "" : "s"} left`}</Tag>
              <button onClick={() => restore(it)} disabled={busy === it.id} className="rounded-full border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-50">{busy === it.id ? "Restoring…" : "Restore"}</button>
              {me?.isAdmin && (
                <button onClick={() => setAsk({ kind: "one", item: it })} aria-label={`Delete ${it.name} for good`} title="Delete for good" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-bad-bg hover:text-bad-fg"><Icon name="x" size={14} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {ask && (
        <ConfirmDialog
          title={ask.kind === "all" ? "Empty Trash?" : "Delete for good?"} confirmLabel={ask.kind === "all" ? "Empty Trash" : "Delete for good"} danger busy={busy === "purge"}
          body={ask.kind === "all" ? `Everything in Trash, including every version, comment and uploaded file, will be removed. This can't be undone.` : `“${ask.item.name}”, with all its versions, comments and uploaded files, will be removed. This can't be undone.`}
          onCancel={() => setAsk(null)} onConfirm={purge}
        />
      )}
    </main>
  );
}
