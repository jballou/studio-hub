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
          {assets.map((a) => (
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
          ))}
        </ul>
      )}
    </main>
  );
}
