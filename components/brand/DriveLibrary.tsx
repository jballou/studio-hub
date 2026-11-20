"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useMe } from "@/hooks/useMe";
import { isJira } from "@/lib/data/mode";

type Item = { id: string; name: string; mimeType: string; folder: boolean; size?: number; width?: number; height?: number };
type Listing = { configured: false } | { configured: true; folder: string; trail: { id: string; name: string }[]; items: Item[] };
type Kind = "photos" | "illustrations";

const file = (kind: Kind, id: string, mode: "thumb" | "download", s?: number, webp?: boolean) => `/api/brand/drive/file/${id}?kind=${kind}&mode=${mode}${s ? `&s=${s}` : ""}${webp ? "&format=webp" : ""}`;
/** JPG and PNG can also be saved as WebP, which is much smaller. */
const canWebp = (i: Item) => i.mimeType === "image/jpeg" || i.mimeType === "image/png";
const extOf = (i: Item) => (i.mimeType === "image/jpeg" ? "JPG" : i.mimeType === "image/png" ? "PNG" : i.mimeType === "application/pdf" ? "PDF" : "File");
const mb = (n?: number) => (n ? (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`) : "");

/** A Drive-backed library: folders become categories, images show Drive's own previews, downloads stream through the Hub. */
export function DriveLibrary({ kind, title, blurb }: { kind: Kind; title: string; blurb: string }) {
  const me = useMe();
  const [folder, setFolder] = useState<string | null>(null);
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Item | null>(null);

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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items = useMemo(() => (data && data.configured ? data.items : []), [data]);
  const shown = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => t.every((w) => i.name.toLowerCase().includes(w)));
  }, [items, q]);
  const folders = shown.filter((i) => i.folder);
  const files = shown.filter((i) => !i.folder);

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
      <p className="mb-4 max-w-3xl text-sm text-muted">{blurb}</p>
      <nav aria-label="Folder" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {trail.map((t, i) => (
          <span key={t.id} className="flex items-center gap-2">
            {i > 0 && <Icon name="chevronRight" size={14} />}
            {i === trail.length - 1 ? <span className="font-bold">{i === 0 ? title : t.name}</span> : <button onClick={() => { setFolder(i === 0 ? null : t.id); setQ(""); }} className="text-brand hover:underline">{i === 0 ? title : t.name}</button>}
          </span>
        ))}
      </nav>
      <label className="relative mb-6 block max-w-xl">
        <span className="sr-only">Search this folder</span>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this folder" className="block h-10 w-full rounded-tight border border-control bg-white pl-10 pr-4 text-sm" />
      </label>

      {folders.length > 0 && (
        <ul className="mb-6 grid gap-4 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
          {folders.map((f) => (
            <li key={f.id}>
              <button onClick={() => { setFolder(f.id); setQ(""); }} className="card card-hover flex w-full items-center gap-4 p-4 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tight bg-brand-soft"><Icon name="folder" size={20} /></span>
                <span className="min-w-0 truncate text-sm font-bold">{f.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
          {files.map((f) => (
            <li key={f.id} className="card overflow-hidden">
              <button onClick={() => setOpen(f)} className="block aspect-[4/3] w-full bg-n-150" aria-label={`Preview ${f.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file(kind, f.id, "thumb", 480)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" title={f.name}>{f.name}</p>
                  <p className="truncate text-xs text-muted">{f.width && f.height ? `${f.width}×${f.height} · ` : ""}{mb(f.size)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={file(kind, f.id, "download")} download className="btn btn-sm btn-secondary" aria-label={`Download ${f.name} as ${extOf(f)}`}>{extOf(f)}</a>
                  {canWebp(f) && <a href={file(kind, f.id, "download", undefined, true)} download className="btn btn-sm btn-secondary" aria-label={`Download ${f.name} as WebP`}>WebP</a>}
                </div>
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
              <div className="flex shrink-0 gap-2">
                <a href={file(kind, open.id, "download")} download className="btn btn-md btn-primary"><Icon name="download" size={16} />Download {extOf(open)}{open.size ? ` (${mb(open.size)})` : ""}</a>
                {canWebp(open) && <a href={file(kind, open.id, "download", undefined, true)} download className="btn btn-md btn-secondary"><Icon name="download" size={16} />Download WebP</a>}
                <button onClick={() => setOpen(null)} className="btn btn-md btn-secondary" autoFocus>Close</button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-n-150 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={file(kind, open.id, "thumb", 1600)} alt={open.name} className="max-h-[70vh] max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
