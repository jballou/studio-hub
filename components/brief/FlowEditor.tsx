"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { flowRepo, type FlowVersion } from "@/lib/data";
import { addAfter, deleteNode } from "@/lib/brief/edit";
import { validateFlow, type Flow } from "@/lib/brief/flow";
import { useMe } from "@/hooks/useMe";
import { BriefWizard } from "./BriefWizard";
import { FlowChart } from "./FlowChart";
import { RouteView } from "./RouteView";
import { NodeInspector } from "./NodeInspector";

const when = (iso: string) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "built-in");

/** Where the creative team edits the brief questions: a map of the flow on the left, one question's details on the right. */
export function FlowEditor() {
  const me = useMe();
  const [saved, setSaved] = useState<Flow | null>(null);
  const [draft, setDraft] = useState<Flow | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [history, setHistory] = useState<FlowVersion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(0.9);
  const [view, setView] = useState<"types" | "map">("types");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!preview) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [preview]);
  const [showProblems, setShowProblems] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await flowRepo.get();
      setSaved(s.flow);
      setDraft(s.flow);
      setIsDefault(s.isDefault);
      setHistory(s.history);
      setSelected((cur) => (cur && s.flow.nodes.some((n) => n.id === cur) ? cur : s.flow.start));
      setError(null);
      setConflict(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the questions.");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify({ ...saved, version: 0, updatedAt: "", updatedBy: "" }) !== JSON.stringify({ ...draft, version: 0, updatedAt: "", updatedBy: "" }), [saved, draft]);
  const problems = useMemo(() => (draft ? validateFlow(draft) : { errors: [], warnings: [] }), [draft]);

  // Don't let someone close the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (me && me.role !== "creative") {
    return <main className="page [&>*:not(.fixed)]:max-w-3xl"><h1 className="text-2xl font-bold">Brief builder</h1><p className="mt-2 text-sm text-muted">Only the creative team can edit the brief questions.</p></main>;
  }
  if (!draft || !saved) return <main className="p-8 text-sm text-muted">{error ?? "Loading…"}</main>;

  const node = draft.nodes.find((n) => n.id === selected) ?? null;
  const problemIds = new Set<string>();
  if (problems.errors.length) for (const n of draft.nodes) if (!n.prompt.trim() || (n.options?.length ?? 0) < 2 && (n.qtype === "choice" || n.qtype === "multichoice")) problemIds.add(n.id);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice(done);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setConflict(/changed while you were editing|Someone else/i.test(msg));
    }
    setBusy(false);
  };

  const guard = (fn: () => void) => { if (!dirty || confirm("You have unsaved changes. They will be lost.")) fn(); };

  return (
    <main className="page">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Brief builder</h1>
        <Tag tone={isDefault ? "neutral" : "ok"}>{isDefault ? "Built-in questions" : `Version ${saved.version}`}</Tag>
        {dirty && <Tag tone="warn" icon="alert">Unsaved changes</Tag>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setPreview(true)} className="btn btn-md btn-secondary">Preview as a requester</button>
          {history.length > 0 && (
            <label className="text-sm">
              <span className="sr-only">Restore an earlier version</span>
              <select value="" disabled={busy} onChange={(e) => { const v = Number(e.target.value); if (v && confirm(`Publish version ${v} again as the current questions?`)) guard(() => act(() => flowRepo.restore(v), `Restored version ${v}.`)); }} className="rounded-lg border border-control bg-white px-2 py-2 text-sm">
                <option value="">Earlier versions…</option>
                {history.map((h) => <option key={h.version} value={h.version}>v{h.version} · {when(h.updatedAt)} · {h.updatedBy}</option>)}
              </select>
            </label>
          )}
          {me?.isAdmin && !isDefault && <button disabled={busy} onClick={() => { if (confirm("Go back to the built-in questions? Your version stays in history.")) guard(() => act(() => flowRepo.reset(), "Back to the built-in questions.")); }} className="btn btn-md btn-danger">Reset to built-in</button>}
          <button disabled={!dirty || busy} onClick={() => { setDraft(saved); setNotice(null); setError(null); }} className="btn btn-md btn-secondary">Discard</button>
          <button disabled={!dirty || busy || problems.errors.length > 0} onClick={() => act(() => flowRepo.save(draft, saved.version), "Saved. New briefs use these questions now.")} className="btn btn-md btn-primary">{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">This is the conversation a requester has when they start a brief. Click a question to edit it. &ldquo;By request type&rdquo; shows what each kind of request is asked; the full map shows every question and rule, where dashed lines send some answers somewhere else.</p>

      {error && <div className="mb-4 flex flex-wrap items-center gap-2"><Callout tone="bad" icon="alert">{error}</Callout>{conflict && <button onClick={load} className="btn btn-md btn-secondary">Load the latest version</button>}</div>}
      {notice && <div className="mb-4"><Callout tone="ok" icon="check">{notice}</Callout></div>}

      {(problems.errors.length > 0 || problems.warnings.length > 0) && (
        <div className="mb-4 card">
          <button onClick={() => setShowProblems((s) => !s)} aria-expanded={showProblems} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm">
            {problems.errors.length > 0 && <Tag tone="bad" icon="close">{problems.errors.length} {problems.errors.length === 1 ? "problem" : "problems"} to fix before saving</Tag>}
            {problems.warnings.length > 0 && <Tag tone="warn" icon="alert">{problems.warnings.length} to check</Tag>}
            <span className={`ml-auto ${showProblems ? "rotate-180" : ""}`}><Icon name="chevronDown" size={14} /></span>
          </button>
          {(showProblems || problems.errors.length > 0) && (
            <ul className="space-y-2 border-t border-line px-4 py-2 text-sm">
              {problems.errors.map((e) => <li key={e} className="text-bad-fg">• {e}</li>)}
              {problems.warnings.map((w) => <li key={w} className="text-warn-fg">• {w}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex min-h-[560px] flex-col gap-4 lg:flex-row">
        <section aria-label="Question map" className="relative min-h-80 min-w-0 flex-1 overflow-auto card" onPointerDown={(e) => {
          if (view !== "map" || (e.target as HTMLElement).closest("button,select")) return;
          const el = e.currentTarget; const x = e.clientX, y = e.clientY, sl = el.scrollLeft, st = el.scrollTop;
          const move = (m: PointerEvent) => { el.scrollLeft = sl - (m.clientX - x); el.scrollTop = st - (m.clientY - y); };
          const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
          window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
        }}>
          <div className="sticky left-0 top-0 z-10 flex w-full flex-wrap items-center gap-2 border-b border-line bg-white/90 p-2 text-xs backdrop-blur">
            <div role="tablist" aria-label="Map view" className="flex rounded-lg bg-n-150 p-px">
              {([["types", "By request type"], ["map", "Full map"]] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-lg px-4 py-2 font-medium ${view === k ? "bg-white shadow-sm" : "text-muted hover:text-n-1000"}`}>{l}</button>
              ))}
            </div>
            {view === "map" && (
              <>
                <button aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.4, +(s - 0.1).toFixed(1)))} className="rounded px-2 py-2 hover:bg-n-150">−</button>
                <span className="w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
                <button aria-label="Zoom in" onClick={() => setScale((s) => Math.min(1.3, +(s + 0.1).toFixed(1)))} className="rounded px-2 py-2 hover:bg-n-150">+</button>
                <button onClick={() => setScale(0.6)} className="rounded px-2 py-2 hover:bg-n-150">Fit</button>
              </>
            )}
            <button onClick={() => { const r = addAfter(draft, selected); setDraft(r.flow); setSelected(r.id); }} className="ml-auto rounded bg-brand-soft px-4 py-2 font-medium hover:bg-n-150">+ Question</button>
          </div>
          {view === "types"
            ? <RouteView flow={draft} selectedId={selected} onSelect={setSelected} problemIds={problemIds} />
            : <div className="cursor-grab p-2 active:cursor-grabbing"><FlowChart flow={draft} selectedId={selected} onSelect={setSelected} scale={scale} problemIds={problemIds} /></div>}
        </section>

        <aside aria-label="Question details" className="w-full shrink-0 overflow-y-auto card p-4 lg:max-h-[calc(100vh-190px)] lg:w-[380px]">
          {node ? (
            <NodeInspector
              key={node.id}
              flow={draft}
              node={node}
              onFlow={setDraft}
              onAddAfter={() => { const r = addAfter(draft, node.id); setDraft(r.flow); setSelected(r.id); }}
              onDelete={() => { if (confirm("Delete this question? Anything pointing to it is re-linked to what comes next.")) { const next = deleteNode(draft, node.id); setDraft(next); setSelected(next.start || null); } }}
            />
          ) : (
            <p className="text-sm text-muted">Select a question on the map to edit it.</p>
          )}
        </aside>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={() => setPreview(false)}>
          <div role="dialog" aria-modal="true" aria-label="Preview" className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-2">
              <p className="text-sm font-semibold">Preview{dirty ? " (with your unsaved changes)" : ""}</p>
              <button onClick={() => setPreview(false)} aria-label="Close preview" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full hover:bg-n-150"><Icon name="x" size={16} /></button>
            </div>
            <div className="overflow-y-auto"><BriefWizard flow={draft} preview /></div>
          </div>
        </div>
      )}
    </main>
  );
}
