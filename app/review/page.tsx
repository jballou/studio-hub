import { Suspense } from "react";
import Link from "next/link";
import { repo } from "@/lib/data";

async function AssetList() {
  const assets = await repo.listAssets();
  return (
    <ul className="space-y-2">
      {assets.map((a) => (
        <li key={a.id}>
          <Link href={`/review/${a.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-white p-4 hover:border-brand">
            <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold uppercase text-ink">{a.kind}</span>
            <span className="font-medium">{a.name}</span>
            <span className="ml-auto font-mono text-xs text-muted">{a.projectKey}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewIndex() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Review</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <AssetList />
      </Suspense>
    </main>
  );
}
