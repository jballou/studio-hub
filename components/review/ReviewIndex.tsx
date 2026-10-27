"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tag } from "@/components/ui/Tag";
import { repo } from "@/lib/data";
import { formatDue } from "@/lib/time";
import type { Asset, SourceKind, User } from "@/lib/types";

const SOURCE_LABEL: Record<SourceKind, string> = {
  figma: "Figma", staging: "Landing page", drive: "Google Drive", slides: "Google Slides", upload: "Upload",
};

/** One row per batch; everything else stays one row per asset. Order follows the first item of each. */
function groupBatches(assets: Asset[]): { id: string; title: string; items: Asset[] }[] {
  const out: { id: string; title: string; items: Asset[] }[] = [];
  const byBatch = new Map<string, { id: string; title: string; items: Asset[] }>();
  for (const a of assets) {
    if (!a.batch) { out.push({ id: a.id, title: a.name, items: [a] }); continue; }
    let g = byBatch.get(a.batch.id);
    if (!g) { g = { id: a.batch.id, title: a.batch.title, items: [] }; byBatch.set(a.batch.id, g); out.push(g); }
    g.items.push(a);
  }
  for (const g of byBatch.values()) g.items.sort((x, y) => (x.batch?.index ?? 0) - (y.batch?.index ?? 0));
  return out;
}

export function ReviewIndex() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    repo.listAssets().then(setAssets);
    repo.listUsers().then(setUsers);
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <div className="mb-6 flex items-center">
        <h1 className="text-2xl font-bold">Review</h1>
        <Link href="/submit" className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Submit for feedback</Link>
      </div>
      {assets === null ? <p className="text-sm text-muted">Loading…</p> : (
        <ul className="space-y-2">
          {groupBatches(assets).map((g) => g.items.length > 1 ? (
            <li key={g.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-center gap-3">
                <Tag tone="info">Batch of {g.items.length}</Tag>
                <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                <span className="font-mono text-xs text-muted">{g.items[0].projectKey}</span>
              </div>
              {g.items[0].submittedBy && <p className="mt-1 text-xs text-muted">From {users.find((u) => u.id === g.items[0].submittedBy)?.name ?? "a teammate"}{g.items[0].dueAt ? ` · feedback by ${formatDue(g.items[0].dueAt, g.items[0].dueTz)}` : ""}</p>}
              <ol className="mt-2 flex flex-wrap gap-1.5">
                {g.items.map((a) => (
                  <li key={a.id}><Link href={`/review/${a.id}`} className="inline-flex max-w-56 items-center gap-1.5 truncate rounded-full border border-control bg-white px-3 py-1 text-sm hover:bg-brand-soft"><span className="font-semibold">{(a.batch?.index ?? 0) + 1}</span> {a.name}</Link></li>
                ))}
              </ol>
            </li>
          ) : g.items.map((a) => (
            <li key={a.id}>
              <Link href={`/review/${a.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 hover:border-brand">
                <Tag tone="neutral">{a.source ? SOURCE_LABEL[a.source.kind] : a.kind}</Tag>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.name}</span>
                  {a.submittedBy && <span className="block text-xs text-muted">From {users.find((u) => u.id === a.submittedBy)?.name ?? "a teammate"}{a.dueAt ? ` · feedback by ${formatDue(a.dueAt, a.dueTz)}` : ""}</span>}
                </span>
                <span className="font-mono text-xs text-muted">{a.projectKey}</span>
              </Link>
            </li>
          )))}
        </ul>
      )}
    </main>
  );
}
