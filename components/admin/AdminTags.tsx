"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Icon } from "@/components/ui/Icon";
import { useMe } from "@/hooks/useMe";
import { isJira } from "@/lib/data/mode";
import { labelOf, type TagInfo } from "@/lib/brand/related";

type Kind = "photos" | "illustrations";
type Entry = TagInfo & { ed?: boolean };
const PAGE = 24;

async function api(method: string, body?: unknown, qs = "") {
  const r = await fetch(`/api/brand/tags${qs}`, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? `Something went wrong (${r.status}).`);
  return b;
}

/** For the creative team: see every image's tags, fix them, and rename or remove a tag everywhere. */
export function AdminTags() {
  const me = useMe();
  const [kind, setKind] = useState<Kind>("photos");
  const [items, setItems] = useState<Record<string, Entry> | null>(null);
  const [status, setStatus] = useState<{ total: number; tagged: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [pick, setPick] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [run, setRun] = useState<{ left: number | null; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = !!me && (me.role === "creative" || me.isAdmin);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, st] = await Promise.all([api("GET", undefined, `?kind=${kind}`), api("POST", { kind, status: true }).catch(() => null)]);
      setItems(t.items);
      setStatus(st ? { total: st.total, tagged: st.tagged } : null);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load."); setItems({}); }
  }, [kind]);
  useEffect(() => {
    if (!isJira || !allowed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, allowed]);

  const vocab = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of Object.values(items ?? {})) for (const t of e.t) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);
  const rows = useMemo(() => {
    const w = q.toLowerCase().split(/\s+/).filter(Boolean);
    return Object.entries(items ?? {}).filter(([, e]) => w.every((x) => e.n.toLowerCase().includes(x) || e.t.some((t) => t.includes(x)))).sort((a, b) => a[1].n.localeCompare(b[1].n));
  }, [items, q]);

  if (!isJira) return <main className="page"><PageTitle>Image tags</PageTitle><p className="text-sm text-muted">Image tags are available once sign-in is turned on.</p></main>;
  if (me && !allowed) return <main className="page"><PageTitle>Image tags</PageTitle><p className="text-sm text-muted">Only the creative team can edit tags.</p></main>;

  const save = async (id: string, tags: string[]) => {
    setItems((cur) => (cur ? { ...cur, [id]: { ...cur[id], t: tags, ed: true } } : cur));
    try { await api("PUT", { kind, id, tags }); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); load(); }
  };
  const global = async (from: string, to: string | null) => {
    setBusy(true); setError(null);
    try { await api("PATCH", to === null ? { kind, from, remove: true } : { kind, from, to }); setPick(null); setRename(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't change the tag."); }
    setBusy(false);
  };
  const tagRest = async () => {
    setRun({ left: null, failed: 0 }); setError(null);
    let failed = 0;
    try {
      for (let n = 0; n < 40; n++) {
        const r = await api("POST", { kind, run: true });
        failed += r.failed;
        if (r.error) setError(`Tagging failed: ${r.error}`);
        setRun({ left: r.remaining, failed });
        if (r.remaining === 0 || r.done === 0) break;
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't tag."); }
    setRun((r) => (r ? { ...r, left: r.left ?? 0 } : r));
  };
  const left = status ? status.total - status.tagged : 0;

  return (
    <main className="page [&>*:not(.fixed)]:max-w-4xl">
      <PageTitle>Image tags</PageTitle>
      <p className="mb-6 text-sm text-muted">Tags are suggested automatically when a Drive folder is connected, and they power search, related images and the tag chips in the preview. Fix any that are wrong. Images you edit are never re-tagged automatically.</p>

      <div role="radiogroup" aria-label="Library" className="mb-6 flex gap-2">
        {(["photos", "illustrations"] as const).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setItems(null); setStatus(null); setPick(null); setShown(PAGE); setRun(null); }} className="chip chip-lg" data-on={kind === k}>{k === "photos" ? "Photos" : "Illustrations"}</button>
        ))}
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-bad-fg">{error}</p>}
      {!items ? <p className="text-sm text-muted">Loading…</p> : (
        <>
          <section className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="text-sm">{status ? <><strong>{status.tagged}</strong> of <strong>{status.total}</strong> images tagged{left > 0 ? `, ${left} to go` : ""}.</> : `${Object.keys(items).length} images tagged.`}</p>
            <div className="flex items-center gap-4">
              {run && <span role="status" className="text-sm text-muted">{run.left === null ? "Tagging…" : run.left > 0 ? `${run.left} left${run.failed ? `, ${run.failed} failed` : ""}…` : `Done${run.failed ? `, ${run.failed} failed` : ""}.`}</span>}
              <button onClick={tagRest} disabled={(!!run && run.left !== 0) || left === 0} className="btn btn-md btn-secondary">Tag the rest now</button>
            </div>
          </section>

          <section className="card mb-6 p-6" aria-labelledby="vocab-h">
            <h2 id="vocab-h" className="text-lg font-bold">All tags</h2>
            <p className="mt-2 text-sm text-muted">Pick one to rename it or remove it from every image. Renaming to a tag that already exists merges them.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {vocab.map(([t, n]) => (
                <li key={t}><button onClick={() => { setPick(pick === t ? null : t); setRename(t); }} className="chip" data-on={pick === t}>{labelOf(t)}<span className="text-muted">{n}</span></button></li>
              ))}
              {vocab.length === 0 && <li className="text-sm text-muted">No tags yet.</li>}
            </ul>
            {pick && (
              <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (rename.trim() && rename.trim().toLowerCase() !== pick) global(pick, rename); }}>
                <label className="sr-only" htmlFor="rename">New name for {pick}</label>
                <input id="rename" value={rename} onChange={(e) => setRename(e.target.value)} maxLength={32} className="h-10 w-64 rounded-tight border border-control bg-white px-4 text-sm" />
                <button type="submit" disabled={busy || !rename.trim() || rename.trim().toLowerCase() === pick} className="btn btn-md btn-secondary">Rename</button>
                <button type="button" onClick={() => global(pick, null)} disabled={busy} className="btn btn-md btn-danger">Remove from all images</button>
              </form>
            )}
          </section>

          <section aria-labelledby="img-h">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <h2 id="img-h" className="text-lg font-bold">Images</h2>
              <label className="relative block w-72 max-w-full">
                <span className="sr-only">Filter images</span>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
                <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Filter by name or tag" className="block h-10 w-full rounded-tight border border-control bg-white pl-10 pr-4 text-sm" />
              </label>
            </div>
            <ul className="card divide-y divide-line overflow-hidden">
              {rows.slice(0, shown).map(([id, e]) => <Row key={id} id={id} e={e} kind={kind} onSave={save} />)}
              {rows.length === 0 && <li className="p-6 text-sm text-muted">{q ? "Nothing matches." : "Nothing is tagged yet."}</li>}
            </ul>
            {rows.length > shown && <button onClick={() => setShown((n) => n + PAGE)} className="btn btn-md btn-secondary mt-4">Show more ({rows.length - shown} left)</button>}
          </section>
        </>
      )}
    </main>
  );
}

function Row({ id, e, kind, onSave }: { id: string; e: Entry; kind: Kind; onSave: (id: string, tags: string[]) => void }) {
  const [add, setAdd] = useState("");
  const commit = () => {
    const t = add.toLowerCase().replace(/[^a-z0-9 \-+]/g, "").trim();
    setAdd("");
    if (t && !e.t.includes(t)) onSave(id, [...e.t, t]);
  };
  return (
    <li className="flex items-start gap-4 p-4">
      <span className={`block h-16 w-24 shrink-0 overflow-hidden rounded-tight ${e.m === "image/png" ? "checker" : "bg-n-150"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/brand/drive/file/${id}?kind=${kind}&mode=thumb&s=200`} alt="" loading="lazy" className="h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" title={e.n}>{e.n}{e.ed && <span className="ml-2 text-xs font-normal text-muted">edited</span>}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {e.t.map((t) => (
            <li key={t} className="chip pr-2">{labelOf(t)}
              <button onClick={() => onSave(id, e.t.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="flex h-5 w-5 items-center justify-center rounded-round hover:bg-n-150"><Icon name="x" size={12} /></button>
            </li>
          ))}
          <li>
            <label className="sr-only" htmlFor={`add-${id}`}>Add a tag to {e.n}</label>
            <input id={`add-${id}`} value={add} onChange={(x) => setAdd(x.target.value)} onKeyDown={(x) => { if (x.key === "Enter") { x.preventDefault(); commit(); } }} onBlur={commit} maxLength={32} placeholder="Add a tag" className="h-8 w-32 rounded-round border border-control bg-white px-4 text-sm" />
          </li>
        </ul>
      </div>
    </li>
  );
}
