"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Callout } from "@/components/ui/Tag";
import { Logo } from "@/components/ui/Logo";
import { flowRepo, projectsRepo } from "@/lib/data";
import { display, interpolate, walk, type AnswerValue, type Answers, type Flow, type QNode } from "@/lib/brief/flow";
import { toSubmission } from "@/lib/brief/submit";
import { QuestionInput } from "./QuestionInput";

const DRAFT_KEY = "brief-wizard-draft-v1";

function Assistant({ children }: { children: React.ReactNode }) {
  return (
    <div className="rise flex items-start gap-4">
      <Logo size={32} className="mt-0" />
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-sm border border-line bg-white px-4 py-4">{children}</div>
    </div>
  );
}

/**
 * Asks for a brief one question at a time. The questions come from the flow (editable in Admin), so each request
 * type gets its own questions. In preview mode (used by the editor) nothing is saved or sent.
 */
export function BriefWizard({ flow: flowProp, preview = false }: { flow?: Flow; preview?: boolean }) {
  const [loaded, setLoaded] = useState<Flow | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const flow = flowProp ?? loaded;

  useEffect(() => {
    if (flowProp) return;
    let live = true;
    flowRepo.get().then((s) => { if (live) setLoaded(s.flow); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [flowProp]);

  // Pick up a saved draft (not in preview), so closing the tab doesn't lose the answers.
  useEffect(() => {
    if (preview) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Answers;
        if (Object.keys(saved).length) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setAnswers(saved);
          setResumed(true);
        }
      }
    } catch { /* ignore a bad draft */ }
  }, [preview]);
  useEffect(() => {
    if (preview || created) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(answers)); } catch { /* storage unavailable */ }
  }, [answers, preview, created]);

  const w = useMemo(() => (flow ? walk(flow, answers) : null), [flow, answers]);
  const answeredCount = w?.path.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [answeredCount, editing, created]);

  if (!flow || !w) return <p className="p-8 text-sm text-muted">{error ?? "Loading…"}</p>;

  const answer = (node: QNode, v: AnswerValue) => { setAnswers((a) => ({ ...a, [node.field]: v })); setEditing(null); setError(null); };
  const startOver = () => { setAnswers({}); setEditing(null); setResumed(false); setError(null); try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };
  const q = (n: QNode) => interpolate(n.prompt, flow, answers);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await projectsRepo.createBrief(toSubmission(flow, answers), "u-riley");
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setCreated(res.jiraKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the ticket.");
    }
    setBusy(false);
  };

  if (created) {
    return (
      <main className="page [&>*]:max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold">Brief submitted</h1>
        <p className="mb-4">Created <Link href={`/projects/${created}`} className="rounded bg-line px-2 py-0 font-mono text-sm text-brand hover:underline">{created}</Link>. It&apos;s in <Link href="/briefs" className="text-brand underline">My briefs</Link>, where you can follow it.</p>
        <div className="flex gap-2">
          <Link href="/briefs" className="rounded-lg bg-brand px-4 py-2 font-medium text-n-50 hover:bg-brand-dark">See it in My briefs</Link>
          <Link href={`/projects/${created}`} className="rounded-lg border border-control px-4 py-2 font-medium hover:bg-brand-soft">Open project</Link>
          <button onClick={startOver} className="rounded-lg border border-control px-4 py-2 font-medium hover:bg-brand-soft">Start another</button>
        </div>
      </main>
    );
  }

  const sub = w.current === null ? toSubmission(flow, answers) : null;

  return (
    <main className={`page [&>*]:max-w-2xl ${preview ? "!py-4" : ""}`}>
      {!preview && (
        <div className="mb-6 flex items-center gap-4">
          <h1 className="text-2xl font-bold">New brief</h1>
          {answeredCount > 0 && <button onClick={startOver} className="ml-auto text-sm font-medium text-muted hover:underline">Start over</button>}
        </div>
      )}
      {resumed && !preview && answeredCount > 0 && <div className="mb-4"><Callout tone="info" icon="check">Picked up where you left off. Your answers are saved on this device.</Callout></div>}

      <div className="space-y-4" aria-live="polite">
        {w.path.map((n) => (
          <div key={n.id} className="space-y-2">
            <Assistant><p className="text-sm">{q(n)}</p></Assistant>
            {editing === n.id ? (
              <div className="ml-12"><QuestionInput node={n} initial={answers[n.field]} submitLabel="Save" onSubmit={(v) => answer(n, v)} onCancel={() => setEditing(null)} /></div>
            ) : (
              <div className="rise flex justify-end gap-2">
                <button onClick={() => setEditing(n.id)} className="self-center text-xs font-medium text-muted hover:underline" aria-label={`Edit your answer to: ${q(n)}`}>Edit</button>
                <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-brand px-4 py-2 text-sm text-n-50">
                  {display(n, answers[n.field]) || <span className="opacity-80">Skipped</span>}
                </p>
              </div>
            )}
          </div>
        ))}

        {w.current && (
          <div className="space-y-4">
            <Assistant>
              <p className="text-sm">{q(w.current)}</p>
              {w.current.help && <p className="mt-2 text-sm text-muted">{interpolate(w.current.help, flow, answers)}</p>}
            </Assistant>
            <div className="rise ml-12"><QuestionInput key={w.current.id} node={w.current} onSubmit={(v) => answer(w.current!, v)} /></div>
          </div>
        )}

        {sub && (
          <div className="space-y-4">
            <Assistant><p className="text-sm">That&apos;s everything I need. Here&apos;s what I&apos;ll send. Look right?</p></Assistant>
            <section className="rise ml-12 rounded-2xl border border-line bg-white p-6" aria-label="Brief summary">
              <p className="text-muted eyebrow">{sub.typeLabel}</p>
              <h2 className="mb-4 text-xl font-bold">{sub.title}</h2>
              <dl className="space-y-4 text-sm">
                {sub.deadline && <div><dt className="font-semibold">Needed by</dt><dd>{sub.deadline}</dd></div>}
                {sub.stakeholders.length > 0 && <div><dt className="font-semibold">Keeping in the loop</dt><dd>{sub.stakeholders.map((p) => p.name).join(", ")}</dd></div>}
                {sub.sections.map((s) => <div key={s.label}><dt className="font-semibold">{s.label}</dt><dd className="whitespace-pre-wrap">{s.value}</dd></div>)}
              </dl>
              {error && <div className="mt-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {preview ? (
                  <p className="text-sm text-muted">Preview only. Nothing is sent from here.</p>
                ) : (
                  <button onClick={submit} disabled={busy} className="rounded-xl bg-brand px-6 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">{busy ? "Submitting…" : "Submit brief"}</button>
                )}
                <span className="text-xs text-muted">Click any answer above to change it.</span>
              </div>
            </section>
          </div>
        )}
      </div>
      <div ref={end} className="h-6" />
    </main>
  );
}
