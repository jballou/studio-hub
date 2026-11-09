"use client";

import { useEffect, useRef, useState } from "react";
import { Callout } from "@/components/ui/Tag";
import { meRepo, type InterviewState, type InterviewTurn } from "@/lib/data";
import type { NextQuestion } from "@/lib/me/interview";

/**
 * The weekly check-in: a few questions about what the data can't tell, one at a time. Each answer is saved as a private note
 * and feeds the report. Every question can be skipped, and "why am I asking" shows what prompted it.
 */
export function InterviewPanel({ week, onFinish, onClose }: { week: string; onFinish: () => void; onClose: () => void }) {
  const [state, setState] = useState<InterviewState>({ asked: [], history: [] });
  const [q, setQ] = useState<NextQuestion | null>(null);
  const [turn, setTurn] = useState<InterviewTurn | null>(null);
  const [text, setText] = useState("");
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);

  const apply = (t: InterviewTurn) => {
    setTurn(t);
    setQ(t.next);
    setState({ asked: t.asked, history: t.history });
    if (t.saved) setSaved((n) => n + 1);
    setText("");
    setWhy(false);
  };

  useEffect(() => {
    let live = true;
    meRepo.interview(week, { asked: [], history: [] }).then((t) => { if (live) { apply(t); setBusy(false); } }).catch((e: Error) => { if (live) { setError(e.message); setBusy(false); } });
    return () => { live = false; };
  }, [week]);
  useEffect(() => { if (q) box.current?.focus(); }, [q]);

  const answer = async (value: string) => {
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      apply(await meRepo.interview(week, state, { gapId: q.gapId, text: value }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that answer.");
    }
    setBusy(false);
  };

  const step = turn ? Math.min(turn.asked.length + 1, Math.max(turn.total, 1)) : 1;
  const total = turn ? Math.min(turn.total, turn.max) : 0;

  return (
    <section className="card p-6" aria-labelledby="interview-h">
      <div className="mb-4 flex items-center gap-4">
        <div>
          <h2 id="interview-h" className="text-lg font-bold">Weekly check-in</h2>
          <p className="text-sm text-muted">A few questions about what Jira can&apos;t see. Private to you, and every one can be skipped.</p>
        </div>
        <button onClick={onClose} className="btn btn-md btn-secondary ml-auto">Close</button>
      </div>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      {q ? (
        <div>
          <p className="text-xs font-medium text-muted" aria-live="polite">Question {step} of {total || "?"}</p>
          <p className="mt-2 text-lg font-bold">{q.question}</p>
          {q.chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick answers">
              {q.chips.map((c) => <button key={c} type="button" disabled={busy} onClick={() => setText((t) => (t.trim() ? `${t.trim()}. ${c}` : c))} className="chip">{c}</button>)}
            </div>
          )}
          <label className="mt-4 block text-sm font-bold"><span className="sr-only">Your answer</span>
            <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="A sentence is plenty." className="block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal" />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={() => answer(text)} disabled={busy || !text.trim()} className="btn btn-md btn-primary">{busy ? "Saving…" : "Save and continue"}</button>
            <button onClick={() => answer("")} disabled={busy} className="btn btn-md btn-secondary">Skip</button>
            <button onClick={() => setWhy(!why)} aria-expanded={why} className="ml-auto text-sm font-medium text-muted hover:underline">Why am I asking?</button>
          </div>
          {why && <p className="mt-4 rounded-tight bg-n-150 px-4 py-2 text-sm">{q.why}</p>}
        </div>
      ) : busy ? (
        <p className="text-sm text-muted">Looking at your week…</p>
      ) : !error ? (
        <div>
          <Callout tone="ok" icon="check">That&apos;s everything. {saved ? `${saved} ${saved === 1 ? "answer" : "answers"} saved as private notes.` : "Nothing was added."}</Callout>
          <div className="mt-4 flex gap-2">
            <button onClick={onFinish} className="btn btn-md btn-primary">Draft my report</button>
            <button onClick={onClose} className="btn btn-md btn-secondary">Not now</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
