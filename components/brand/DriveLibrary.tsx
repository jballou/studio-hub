"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useMe } from "@/hooks/useMe";
import { isJira } from "@/lib/data/mode";
import { labelOf, relatedTo, type TagInfo } from "@/lib/brand/related";
import { InspirationWall } from "@/components/brand/InspirationWall";

type Item = { id: string; name: string; mimeType: string; folder: boolean; size?: number; width?: number; height?: number };
type Listing = { configured: false } | { configured: true; folder: string; trail: { id: string; name: string }[]; items: Item[] };
type Kind = "photos" | "illustrations";

const file = (kind: Kind, id: string, mode: "thumb" | "download", s?: number, webp?: boolean) => `/api/brand/drive/file/${id}?kind=${kind}&mode=${mode}${s ? `&s=${s}` : ""}${webp ? "&format=webp" : ""}`;
/** JPG and PNG can also be saved as WebP, which is much smaller. */
const canWebp = (i: Item) => i.mimeType === "image/jpeg" || i.mimeType === "image/png";
const bgOf = (i: Item) => (i.mimeType === "image/png" ? "checker" : "bg-n-150");
const extOf = (i: Item) => (i.mimeType === "image/jpeg" ? "JPG" : i.mimeType === "image/png" ? "PNG" : i.mimeType === "application/pdf" ? "PDF" : i.mimeType === "image/svg+xml" ? "SVG" : i.mimeType === "image/gif" ? "GIF" : i.mimeType === "image/webp" ? "WebP" : "File");
type View = "large" | "small" | "list";
const VIEW_KEY = "brand-gallery-view-v1";
const VIEWS: { id: View; label: string; icon: IconName }[] = [
  { id: "large", label: "Large gallery", icon: "layoutGrid" },
  { id: "small", label: "Small gallery", icon: "grid3x3" },
  { id: "list", label: "List", icon: "list" },
];
const mb = (n?: number) => (n ? (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`) : "");

/** A Drive-backed library: folders become categories, images show Drive's own previews, downloads stream through the Hub. */
export function DriveLibrary({ kind, title }: { kind: Kind; title: string }) {
  const me = useMe();
  const [folder, setFolder] = useState<string | null>(null);
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Item | null>(null);
  const [view, setView] = useState<View>("large");
  const [tags, setTags] = useState<Record<string, TagInfo>>({});
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagging, setTagging] = useState<string | null>(null);
  const [tagError, setTagError] = useState<{ id: string; message: string } | null>(null);
  const canTag = me?.role === "creative" || !!me?.isAdmin;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "large" || v === "small" || v === "list") setView(v); } catch { /* storage unavailable */ }
  }, []);
  const pick = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const load = useCallback(async (f: string | null) => {
    setError(null);
    try {
      const r = await fetch(`/api/brand/drive?kind=${kind}${f ? `&folder=${f}` : ""}`, { cache: "no-store" });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? `Something went wrong (${r.status}).`);
      setData(b as Listing);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, [kind]);

  useEffect(() => {
    if (!isJira) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(folder);
  }, [load, folder]);

  useEffect(() => {
    if (!isJira) return;
    fetch(`/api/brand/tags?kind=${kind}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((b) => { if (b?.items) setTags(b.items); }).catch(() => {});
  }, [kind]);

  // A photo nobody has opened since tagging began gets its tags the first time the creative team looks at it.
  useEffect(() => {
    if (!open || open.folder || tags[open.id] || !canTag || !/^image\/(jpeg|png|webp)$/.test(open.mimeType)) return;
    let live = true;
    const id = open.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTagging(id);
    fetch("/api/brand/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!live) return;
        if (r.ok && b?.entry) { setTags((t) => ({ ...t, [id]: b.entry })); setTagError(null); }
        else setTagError({ id, message: b?.error ?? `Couldn't read this image (${r.status}).` });
      })
      .catch(() => { if (live) setTagError({ id, message: "Couldn't reach the server." }); })
      .finally(() => { if (live) setTagging((x) => (x === id ? null : x)); });
    return () => { live = false; };
  }, [open, tags, canTag, kind]);

  const items = useMemo<Item[]>(() => {
    // A tag search looks across every folder, not only the one you're in.
    if (tagFilter) return Object.entries(tags).filter(([, e]) => e.t.includes(tagFilter)).map(([id, e]) => ({ id, name: e.n, mimeType: e.m, folder: false, size: e.s }));
    return data && data.configured ? data.items : [];
  }, [data, tagFilter, tags]);
  const related = useMemo(() => (open ? relatedTo(open.id, tags) : []), [open, tags]);
  const shown = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => t.every((w) => i.name.toLowerCase().includes(w)));
  }, [items, q]);
  const folders = shown.filter((i) => i.folder);
  const files = shown.filter((i) => !i.folder);
  const at = open ? files.findIndex((f) => f.id === open.id) : -1;
  const prev = at > 0 ? files[at - 1] : null;
  const next = at >= 0 && at < files.length - 1 ? files[at + 1] : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowLeft" && prev) setOpen(prev);
      else if (e.key === "ArrowRight" && next) setOpen(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  if (!isJira) return <p className="text-sm text-muted">{title} appear once sign-in is turned on. They&apos;re read from the brand team&apos;s Google Drive.</p>;
  if (error) return <p className="card max-w-3xl p-6 text-sm text-muted">{error}</p>;
  if (!data) return <p className="text-sm text-muted">Loading {title.toLowerCase()}…</p>;
  if (!data.configured) {
    return (
      <div className="card max-w-3xl p-6">
        <h2 className="text-lg font-bold">{title} aren&apos;t set up yet</h2>
        <p className="mt-2 text-sm text-muted">{me?.isAdmin ? "Point the Hub at the Google Drive folder that holds them." : "An admin needs to connect the Drive folder. Ask the Brand Creative team."}</p>
        {me?.isAdmin && <Link href="/admin/brand" className="btn btn-md btn-primary mt-4">Set up in Preferences</Link>}
      </div>
    );
  }

  const trail = data.trail;
  return (
    <div>
      {tagFilter && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Photos tagged</span>
          <span className="inline-flex items-center gap-2 rounded-round border border-brand bg-brand-soft py-0 pl-4 pr-2 font-bold">{labelOf(tagFilter)}
            <button onClick={() => setTagFilter(null)} aria-label="Clear tag" className="flex h-5 w-5 items-center justify-center rounded-round hover:bg-white/60"><Icon name="x" size={12} /></button>
          </span>
          <span className="text-muted">{files.length} in all folders</span>
        </p>
      )}
      <nav aria-label="Folder" hidden={!!tagFilter || trail.length < 2} className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {trail.map((t, i) => (
          <span key={t.id} className="flex items-center gap-2">
            {i > 0 && <Icon name="chevronRight" size={14} />}
            {i === trail.length - 1 ? <span className="font-bold">{i === 0 ? title : t.name}</span> : <button onClick={() => { setFolder(i === 0 ? null : t.id); setQ(""); }} className="text-brand hover:underline">{i === 0 ? title : t.name}</button>}
          </span>
        ))}
      </nav>
      {folders.length > 0 && !tagFilter && (
        <ul className="mb-6 grid gap-4 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
          {folders.map((f) => (
            <li key={f.id}>
              <button onClick={() => { setFolder(f.id); setQ(""); }} className="card card-hover flex w-full items-center gap-4 rounded-tight p-4 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tight bg-brand-soft"><Icon name="folder" size={20} /></span>
                <span className="min-w-0 truncate text-sm font-bold">{f.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="relative block min-w-0 max-w-xl flex-1">
          <span className="sr-only">Search this folder</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="image" size={16} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you looking for?" className="block h-12 w-full rounded-tight border border-control bg-white pl-10 pr-4 text-sm" />
        </label>
        {files.length > 0 && (
          <div role="radiogroup" aria-label="View" className="ml-auto flex h-12 items-center gap-2 rounded-tight border border-control bg-white px-2">
            {VIEWS.map((v) => (
              <button key={v.id} role="radio" aria-checked={view === v.id} aria-label={v.label} title={v.label} onClick={() => pick(v.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-tight ${view === v.id ? "bg-brand-soft text-brand" : "text-n-800 hover:bg-n-150"}`}>
                <Icon name={v.icon} size={16} />
              </button>
            ))}
          </div>
        )}
      </div>

      {trail.length === 1 && !tagFilter && !q && <InspirationWall kind={kind} onOpen={(i) => setOpen({ ...i, folder: false })} />}

      {files.length > 0 && view !== "list" && (
        <ul className={`grid gap-4 ${view === "large" ? "grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"}`}>
          {files.map((f) => (
            <li key={f.id} className={`card overflow-hidden ${view === "small" ? "rounded-tight" : ""}`}>
              <button onClick={() => setOpen(f)} className={`block aspect-[4/3] w-full ${bgOf(f)}`} aria-label={`Preview ${f.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file(kind, f.id, "thumb", view === "large" ? 800 : 320)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
              {view === "large" ? (
                <div className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" title={f.name}>{f.name}</p>
                    <p className="truncate text-xs text-muted">{f.width && f.height ? `${f.width}×${f.height} · ` : ""}{mb(f.size)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a href={file(kind, f.id, "download")} download className="btn btn-sm btn-secondary" aria-label={`Download ${f.name} as ${extOf(f)}`}><Icon name="download" size={14} />{extOf(f)}</a>
                    {canWebp(f) && <a href={file(kind, f.id, "download", undefined, true)} download className="btn btn-sm btn-secondary" aria-label={`Download ${f.name} as WebP`}><Icon name="download" size={14} />WebP</a>}
                  </div>
                </div>
              ) : (
                <p className="truncate p-2 text-xs font-medium" title={f.name}>{f.name}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && view === "list" && (
        <ul className="card divide-y divide-line overflow-hidden">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-4 p-4">
              <button onClick={() => setOpen(f)} className={`block h-12 w-16 shrink-0 overflow-hidden rounded-tight ${bgOf(f)}`} aria-label={`Preview ${f.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file(kind, f.id, "thumb", 160)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold" title={f.name}>{f.name}</p>
                <p className="truncate text-xs text-muted">{f.width && f.height ? `${f.width}×${f.height} · ` : ""}{extOf(f)} · {mb(f.size)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a href={file(kind, f.id, "download")} download className="btn btn-sm btn-secondary" aria-label={`Download ${f.name} as ${extOf(f)}`}><Icon name="download" size={14} />{extOf(f)}</a>
                {canWebp(f) && <a href={file(kind, f.id, "download", undefined, true)} download className="btn btn-sm btn-secondary" aria-label={`Download ${f.name} as WebP`}><Icon name="download" size={14} />WebP</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {shown.length === 0 && <p className="card p-6 text-sm text-muted">{q ? `Nothing here matches “${q}”.` : "This folder is empty."}</p>}

      {open && (
        <div role="dialog" aria-modal="true" aria-label={open.name} className="fixed inset-0 z-50 flex items-center justify-center bg-n-1000/80 p-6" onClick={() => setOpen(null)}>
          <div className="card flex max-h-full w-full max-w-5xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-line p-4">
              <p className="min-w-0 truncate text-sm font-bold">{open.name}</p>
              <div className="flex shrink-0 items-center gap-2">
                <a href={file(kind, open.id, "download")} download className="btn btn-md btn-primary"><Icon name="download" size={16} />Download {extOf(open)}{open.size ? ` (${mb(open.size)})` : ""}</a>
                {canWebp(open) && <a href={file(kind, open.id, "download", undefined, true)} download className="btn btn-md btn-secondary"><Icon name="download" size={16} />Download WebP</a>}
                {at >= 0 && (
                  <div className="flex gap-2" role="group" aria-label="Browse">
                    <button onClick={() => prev && setOpen(prev)} disabled={!prev} aria-label="Previous image" title="Previous" className="btn btn-icon btn-icon-lg btn-secondary"><Icon name="chevronLeft" size={16} /></button>
                    <button onClick={() => next && setOpen(next)} disabled={!next} aria-label="Next image" title="Next" className="btn btn-icon btn-icon-lg btn-secondary"><Icon name="chevronRight" size={16} /></button>
                  </div>
                )}
                <button onClick={() => setOpen(null)} className="btn btn-icon btn-icon-lg btn-secondary" aria-label="Close" title="Close" autoFocus><Icon name="x" size={16} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="flex items-center justify-center bg-n-150 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file(kind, open.id, "thumb", 1600)} alt={open.name} className={`max-h-[60vh] max-w-full object-contain ${bgOf(open)}`} />
              </div>
              <div className="space-y-6 p-6">
                {(tags[open.id] || tagging === open.id || tagError?.id === open.id) && (
                  <section aria-labelledby="tags-h">
                    <div className="flex items-start gap-6">
                      <h3 id="tags-h" className="flex h-8 shrink-0 items-center gap-2 text-sm font-bold"><Icon name="tag" size={16} />Tags</h3>
                      <div className="min-w-0 flex-1 self-stretch border-l border-line pl-6">
                        {tags[open.id] ? (
                          <ul className="flex flex-wrap gap-2">
                            {tags[open.id].t.map((t) => (
                              <li key={t}><button onClick={() => { setTagFilter(t); setOpen(null); setQ(""); }} className="chip">{labelOf(t)}</button></li>
                            ))}
                          </ul>
                        ) : tagging === open.id ? <p className="flex h-8 items-center text-sm text-muted" role="status">Reading the photo…</p>
                          : <p className="flex min-h-8 items-center text-sm text-bad-fg" role="alert">Couldn&apos;t make tags: {tagError?.message}</p>}
                      </div>
                    </div>
                    {tags[open.id] && <p className="mt-4 text-xs text-muted">Tags are suggested automatically from the picture and can be wrong. Age and gender are broad guesses from how someone looks.</p>}
                  </section>
                )}
                {related.length > 0 && (
                  <section aria-labelledby="rel-h">
                    <h3 id="rel-h" className="text-sm font-bold">Related photos</h3>
                    <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
                      {related.map((rid) => (
                        <li key={rid}>
                          <button onClick={() => setOpen({ id: rid, name: tags[rid].n, mimeType: tags[rid].m, folder: false, size: tags[rid].s })} className={`block aspect-[4/3] w-full overflow-hidden rounded-tight ${bgOf({ mimeType: tags[rid].m } as Item)}`} aria-label={`Open ${tags[rid].n}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={file(kind, rid, "thumb", 320)} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
