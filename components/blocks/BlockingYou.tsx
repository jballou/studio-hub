"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Callout, Tag } from "@/components/ui/Tag";
import { StageTag } from "@/components/ui/Tag";
import { blocksRepo, type MyBlock } from "@/lib/data/blocks";
import { daysSince } from "./BlockedTag";

/** Everything waiting on the signed-in person, with a one-click way to say "done". */
export function BlockingYou() {
  const [blocks, setBlocks] = useState<MyBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    blocksRepo.mine().then((b) => { setBlocks(b); setError(null); }).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("blocks-changed", load);
    return () => window.removeEventListener("blocks-changed", load);
  }, [load]);

  const resolve = async (key: string) => {
    setBusy(true);
    setError(null);
    try {
      await blocksRepo.resolve(key, note);
      setOpenKey(null);
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear that.");
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Blocking you</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Projects that are waiting on something from you. Clear each one when you&apos;ve done what&apos;s needed so the team can keep moving.</p>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      {blocks === null && !error && <p className="text-sm text-muted">Loading…</p>}
      {blocks?.length === 0 && (
        <div className="rounded-xl border border-dashed border-control bg-white/60 p-10 text-center">
          <p className="font-medium">Nothing is waiting on you.</p>
          <p className="mt-1 text-sm text-muted">If a project gets blocked on you, it shows up here and you&apos;ll see a notification in the sidebar.</p>
        </div>
      )}

      <ul className="space-y-3">
        {blocks?.map((b) => {
          const days = daysSince(b.since);
          return (
            <li key={b.key} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted">{b.key}</span>
                {b.project && <StageTag stage={b.project.stage} />}
                <Tag tone={days >= 5 ? "bad" : days >= 2 ? "warn" : "neutral"} icon="alert">Waiting {days === 0 ? "since today" : `${days} ${days === 1 ? "day" : "days"}`}</Tag>
              </div>
              <h2 className="mt-1 text-lg font-semibold">{b.project?.title ?? b.key}</h2>
              <p className="mt-2 rounded-lg bg-n-150 p-3 text-sm"><span className="font-medium">What&apos;s needed: </span>{b.reason}</p>
              <p className="mt-1 text-xs text-muted">Marked by {b.setBy}{b.project?.deadline ? ` · project due ${b.project.deadline}` : ""}</p>

              {openKey === b.key ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note, e.g. Approved in Slack" aria-label="Note" className="min-w-64 flex-1 rounded-lg border border-control bg-white px-3 py-1.5 text-sm" />
                  <button disabled={busy} onClick={() => resolve(b.key)} className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">Confirm</button>
                  <button onClick={() => { setOpenKey(null); setNote(""); }} className="rounded-lg border border-control px-4 py-1.5 text-sm font-medium hover:bg-brand-soft">Cancel</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setOpenKey(b.key)} className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-n-50 hover:bg-brand-dark">I&apos;ve unblocked this</button>
                  <Link href={`/projects/${b.key}`} className="rounded-lg border border-control px-4 py-1.5 text-sm font-medium hover:bg-brand-soft">Open project</Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
