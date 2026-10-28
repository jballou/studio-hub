"use client";

import { useEffect, useMemo, useState } from "react";
import { Callout } from "@/components/ui/Tag";
import { figmaRepo, type FramesResult } from "@/lib/data";
import type { FigmaFrame } from "@/lib/figma";

const THUMB_CHUNK = 24;

/** Pick frames from a Figma file, laid out like Google Slides' "Import slides": a grid of thumbnails with checkboxes. */
export function FramePicker({
  url, alreadyAdded, onBack, onCancel, onImport,
}: {
  url: string;
  /** frame ids already in the batch; shown as added and not selectable */
  alreadyAdded: Set<string>;
  onBack: () => void;
  onCancel: () => void;
  onImport: (file: { key: string; name: string }, frames: { frame: FigmaFrame; thumb?: string }[]) => void;
}) {
  const [res, setRes] = useState<FramesResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [page, setPage] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    figmaRepo.frames(url).then((r) => {
      if (!live) return;
      setRes(r);
      if (r.state === "ok" && r.selected && !alreadyAdded.has(r.selected)) setPicked(new Set([r.selected]));
    });
    return () => { live = false; };
    // alreadyAdded is read once on open; the list can't change while the dialog is up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const file = res?.state === "ok" ? res.file : null;
  const all = useMemo(() => (file ? file.pages.flatMap((p) => p.frames.map((f) => ({ ...f, page: p.name, pageId: p.id }))) : []), [file]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((f) => (page === "all" || f.pageId === page) && (!t || f.name.toLowerCase().includes(t) || (f.section ?? "").toLowerCase().includes(t)));
  }, [all, page, q]);

  // Thumbnails load for what's on screen, a chunk at a time, so a 300-frame file doesn't make 300 render requests up front.
  const [visible, setVisible] = useState(THUMB_CHUNK);
  useEffect(() => {
    if (!file) return;
    const need = shown.slice(0, visible).map((f) => f.id).filter((id) => !(id in thumbs));
    if (!need.length) return;
    let live = true;
    figmaRepo.thumbs(file.key, need).then((t) => { if (live) setThumbs((cur) => ({ ...cur, ...t, ...Object.fromEntries(need.filter((i) => !(i in t)).map((i) => [i, ""])) })); });
    return () => { live = false; };
  }, [file, shown, visible, thumbs]);

  const selectable = shown.filter((f) => !alreadyAdded.has(f.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const count = picked.size;

  const doImport = () => {
    if (!file) return;
    const chosen = all.filter((f) => picked.has(f.id)).map((frame) => ({ frame, thumb: thumbs[frame.id] || undefined }));
    onImport({ key: file.key, name: file.name }, chosen);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Import frames" onMouseDown={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-bold">Import frames</h2>

        {res === null && <p className="py-16 text-center text-sm text-muted">Loading frames from Figma…</p>}
        {res?.state === "not-configured" && (
          <div className="mt-4 space-y-4">
            <Callout tone="warn" icon="alert">Figma isn&apos;t connected to this app yet, so frames can&apos;t be listed. An admin needs to add a Figma access token (see docs/figma-setup.md).</Callout>
            <p className="text-sm text-muted">Until then, copy each frame&apos;s link in Figma (right-click the frame, then Copy link to selection) and add them one at a time, or paste several links with “Add several links”.</p>
          </div>
        )}
        {res?.state === "error" && <div className="mt-4"><Callout tone="bad" icon="alert">{res.message}</Callout></div>}

        {file && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-n-150 text-xs font-bold" aria-hidden>F</span>
              <h3 className="min-w-0 flex-1 truncate text-xl font-semibold">{file.name}</h3>
              <span className="text-sm text-muted" aria-live="polite">{count} out of {all.length} frames selected</span>
              <button onClick={() => setPicked((s) => new Set([...s, ...selectable.map((f) => f.id)]))} className="rounded-full border-2 border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">Select all</button>
              <button onClick={() => setPicked(new Set())} className="px-4 py-2 text-sm font-semibold text-brand hover:underline">Clear</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <select aria-label="Page" value={page} onChange={(e) => { setPage(e.target.value); setVisible(THUMB_CHUNK); }} className="rounded-lg border border-control bg-white px-2 py-2 text-sm">
                <option value="all">All pages ({all.length})</option>
                {file.pages.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.frames.length})</option>)}
              </select>
              <input aria-label="Search frames" value={q} onChange={(e) => { setQ(e.target.value); setVisible(THUMB_CHUNK); }} placeholder="Search frames" className="min-w-48 flex-1 rounded-lg border border-control bg-white px-4 py-2 text-sm" />
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2" onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) setVisible((v) => Math.min(v + THUMB_CHUNK, shown.length)); }}>
              {shown.length === 0 ? <p className="py-10 text-center text-sm text-muted">No frames match.</p> : (
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {shown.map((f, i) => {
                    const added = alreadyAdded.has(f.id);
                    const on = picked.has(f.id);
                    return (
                      <li key={f.id}>
                        <label className={`block ${added ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                          <span className={`relative block aspect-video overflow-hidden rounded-xl border-2 bg-n-150 ${on ? "border-brand" : "border-line hover:border-control"}`}>
                            <input type="checkbox" checked={on || added} disabled={added} onChange={() => toggle(f.id)} aria-label={`${f.name}${added ? " (already added)" : ""}`} className="absolute left-2 top-2 z-10 h-5 w-5 accent-brand" />
                            {thumbs[f.id]
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={thumbs[f.id]} alt="" loading="lazy" className="h-full w-full object-contain" />
                              : <span className="flex h-full w-full items-center justify-center text-xs text-muted">{f.id in thumbs ? "No preview" : i < visible ? "Loading…" : ""}</span>}
                            {added && <span className="absolute bottom-2 right-2 rounded-full bg-white px-2 py-0 text-xs font-medium">Added</span>}
                          </span>
                          <span className="mt-2 block truncate text-sm font-medium">{f.name}</span>
                          <span className="block truncate text-xs text-muted">{f.section ? `${f.section} · ` : ""}{f.w}×{f.h}{page === "all" ? ` · ${f.page}` : ""}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex items-center gap-4">
          <button onClick={onBack} className="px-4 py-2 text-sm font-semibold text-brand hover:underline">Back</button>
          <button onClick={onCancel} className="ml-auto px-4 py-2 text-sm font-semibold text-brand hover:underline">Cancel</button>
          <button onClick={doImport} disabled={!file || count === 0} className="rounded-full bg-brand px-6 py-2 text-sm font-semibold text-n-50 enabled:hover:bg-brand-dark disabled:bg-n-200 disabled:text-n-650">
            {count > 0 ? `Import ${count} ${count === 1 ? "frame" : "frames"}` : "Import frames"}
          </button>
        </div>
      </div>
    </div>
  );
}
