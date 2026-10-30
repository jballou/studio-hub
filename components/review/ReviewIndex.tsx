"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Tag, type Tone } from "@/components/ui/Tag";
import type { IconName } from "@/components/ui/Icon";
import { repo } from "@/lib/data";
import { formatDue } from "@/lib/time";
import { useMe } from "@/hooks/useMe";
import type { Asset, ReviewState, SourceKind, User } from "@/lib/types";

const SOURCE_LABEL: Record<SourceKind, string> = {
  figma: "Figma", staging: "Landing page", drive: "Google Drive", slides: "Google Slides", lottie: "Lottie", wistia: "Wistia", upload: "Upload",
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

const STATES: { id: ReviewState; label: string; tone: Tone; icon: IconName; empty: string }[] = [
  { id: "awaiting", label: "Awaiting feedback", tone: "info", icon: "review", empty: "Nothing is waiting on reviewers." },
  { id: "changes", label: "Changes requested", tone: "warn", icon: "feedback", empty: "No one has asked for changes." },
  { id: "approved", label: "Approved", tone: "ok", icon: "delivered", empty: "Nothing approved yet." },
];

type Group = ReturnType<typeof groupBatches>[number];

/** A batch needs attention if any item has changes requested; it is approved only when every item is. */
function stateOf(g: Group): ReviewState {
  const all = g.items.map((a) => a.review ?? "awaiting");
  return all.includes("changes") ? "changes" : all.every((x) => x === "approved") ? "approved" : "awaiting";
}

function Row({ g, users, showState, onTrash }: { g: Group; users: User[]; showState: boolean; onTrash?: (items: Asset[], label: string) => void }) {
  const first = g.items[0];
  const state = STATES.find((x) => x.id === stateOf(g))!;
  const who = users.find((u) => u.id === first.submittedBy)?.name;
  const reviewers = first.reviewers?.map((p) => p.name).slice(0, 3).join(", ");
  const meta = [first.submittedBy && !showState ? `From ${who ?? "a teammate"}` : null, reviewers ? `Reviewers: ${reviewers}${(first.reviewers?.length ?? 0) > 3 ? "…" : ""}` : null, first.dueAt ? `feedback by ${formatDue(first.dueAt, first.dueTz)}` : null].filter(Boolean).join(" · ");
  const status = <Tag tone={state.tone} icon={state.icon}>{state.label}</Tag>;
  if (g.items.length > 1) {
    return (
      <li className="group relative card p-4">
        <div className={`flex items-center gap-4 ${onTrash ? "pr-12" : ""}`}>
          <Tag tone="neutral">Batch of {g.items.length}</Tag>
          <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
          {status}
          <span className="font-mono text-xs text-muted">{first.projectKey}</span>
        </div>
        {meta && <p className="mt-2 text-xs text-muted">{meta}</p>}
        <ol className="mt-2 flex flex-wrap gap-2">
          {g.items.map((a) => (
            <li key={a.id} className="min-w-0 max-w-56"><Link href={`/review/${a.id}`} title={a.name} className="btn btn-md btn-secondary w-full min-w-0 justify-start"><span className="shrink-0 font-bold">{(a.batch?.index ?? 0) + 1}</span><span className="min-w-0 truncate">{a.name}</span></Link></li>
          ))}
        </ol>
        {onTrash && (
          <button onClick={() => onTrash(g.items, g.title)} aria-label={`Move the batch ${g.title} to Trash`} title="Move the whole batch to Trash" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-round text-muted hover:bg-bad-bg hover:text-bad-fg focus-visible:bg-bad-bg">
            <Icon name="trash" size={16} />
          </button>
        )}
      </li>
    );
  }
  return (
    <li className="group relative">
      <Link href={`/review/${first.id}`} className={`flex items-center gap-4 card p-4 hover:border-brand ${onTrash ? "pr-14" : ""}`}>
        <Tag tone="neutral">{first.source ? SOURCE_LABEL[first.source.kind] : first.kind}</Tag>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{first.name}</span>
          {meta && <span className="block truncate text-xs text-muted">{meta}</span>}
        </span>
        {status}
        <span className="font-mono text-xs text-muted">{first.projectKey}</span>
      </Link>
      {onTrash && (
        <button onClick={() => onTrash([first], first.name)} aria-label={`Move ${first.name} to Trash`} title="Move to Trash" className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-round text-muted hover:bg-bad-bg hover:text-bad-fg focus-visible:bg-bad-bg">
          <Icon name="trash" size={16} />
        </button>
      )}
    </li>
  );
}

export function ReviewIndex() {
  const me = useMe();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<ReviewState | "all">("all");
  const [asking, setAsking] = useState<{ items: Asset[]; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const mayTrash = (a: Asset) => !!me && (me.role === "creative" || a.submittedBy === me.id);
  const trash = async () => {
    if (!asking) return;
    setBusy(true);
    try {
      const done = new Set<string>();
      try { for (const a of asking.items) { await repo.deleteAsset(a.id); done.add(a.id); } } finally { setAssets((cur) => (cur ?? []).filter((x) => !done.has(x.id))); }
    } finally { setBusy(false); setAsking(null); }
  };

  useEffect(() => {
    repo.listAssets().then(setAssets).catch(() => setAssets([]));
    repo.listUsers().then(setUsers);
  }, []);

  const groups = groupBatches(assets ?? []);
  const mine = groups.filter((g) => !!me && g.items[0].submittedBy === me.id);
  const others = groups.filter((g) => !mine.includes(g));
  // The creative team can open everything; "needs your review" is only what you were asked about.
  const named = (g: Group) => !!me && g.items.some((a) => [...(a.reviewers ?? []), ...(a.approvers ?? [])].some((p) => p.id === me.id));
  const asked = others.filter(named);
  const rest = others.filter((g) => !named(g));
  const teamWide = me?.role === "creative";
  const count = (s: ReviewState) => mine.filter((g) => stateOf(g) === s).length;

  return (
    <main className="page">
      <div className="mb-6 flex items-center">
        <h1 className="text-2xl font-bold">Review</h1>
        <Link href="/submit" className="btn btn-md btn-primary ml-auto">Submit for feedback</Link>
      </div>
      {assets === null ? <p className="text-sm text-muted">Loading…</p> : (
        <>
          <section aria-labelledby="mine-h">
            <h2 id="mine-h" className="text-lg font-bold">Submitted by you</h2>
            <div role="tablist" aria-label="Filter by status" className="mb-4 mt-2 flex flex-wrap gap-2">
              {([{ id: "all", label: "All", n: mine.length }, ...STATES.map((s) => ({ id: s.id, label: s.label, n: count(s.id) }))] as const).map((f) => (
                <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className="chip">
                  {f.label} <span className="text-muted">{f.n}</span>
                </button>
              ))}
            </div>
            {mine.length === 0 ? (
              <p className="rounded-loose border border-dashed border-control p-8 text-center text-sm text-muted">You haven&apos;t sent anything for feedback yet. <Link href="/submit" className="font-medium text-brand hover:underline">Submit for feedback</Link></p>
            ) : (
              STATES.filter((s) => filter === "all" || filter === s.id).map((s) => {
                const list = mine.filter((g) => stateOf(g) === s.id);
                return (
                  <div key={s.id} className="mb-6">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Tag tone={s.tone} icon={s.icon}>{s.label}</Tag><span className="text-muted">{list.length}</span></h3>
                    {list.length === 0 ? <p className="rounded-loose border border-dashed border-line p-4 text-sm text-muted">{s.empty}</p> : (
                      <ul className="space-y-2">{list.map((g) => <Row key={g.id} g={g} users={users} showState onTrash={g.items.every(mayTrash) ? (items, label) => setAsking({ items, label }) : undefined} />)}</ul>
                    )}
                  </div>
                );
              })
            )}
          </section>

          {(teamWide ? asked : others).length > 0 && (
            <section aria-labelledby="others-h" className="mt-8">
              <h2 id="others-h" className="mb-2 text-lg font-bold">{teamWide ? "Needs your review" : "Sent to you"}</h2>
              <ul className="space-y-2">{(teamWide ? asked : others).map((g) => <Row key={g.id} g={g} users={users} showState={false} />)}</ul>
            </section>
          )}
          {teamWide && rest.length > 0 && (
            <section aria-labelledby="rest-h" className="mt-8">
              <h2 id="rest-h" className="text-lg font-bold">Everyone else&apos;s</h2>
              <p className="mb-2 text-sm text-muted">Designs from the rest of the team. You can open all of them, but you weren&apos;t asked to review these.</p>
              <ul className="space-y-2">{rest.map((g) => <Row key={g.id} g={g} users={users} showState={false} />)}</ul>
            </section>
          )}
        </>
      )}
      {asking && (
        <ConfirmDialog
          title="Move to Trash?" confirmLabel="Move to Trash" danger busy={busy} onCancel={() => setAsking(null)} onConfirm={trash}
          body={`${asking.items.length > 1 ? `The batch “${asking.label}” (${asking.items.length} items)` : `“${asking.label}”`} and its comments will be hidden for everyone. The creative team can restore ${asking.items.length > 1 ? "them" : "it"} from Trash for 30 days, then ${asking.items.length > 1 ? "they are" : "it is"} removed for good.`}
        />
      )}
    </main>
  );
}
