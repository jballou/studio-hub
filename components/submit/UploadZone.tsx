"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ACCEPT } from "@/lib/media";

export type Upload = { id: string; name: string; size: number; progress: number; secondsLeft: number | null };

export const formatBytes = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1e3))}KB`;

/** Drag-and-drop target with a card and progress bar for each file being read. */
export function UploadZone({ uploads, onFiles, onCancel, hint }: { uploads: Upload[]; onFiles: (files: File[]) => void; onCancel: (id: string) => void; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  return (
    <div>
      <div
        onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${over ? "border-brand bg-brand-soft" : "border-control bg-white"}`}
      >
        <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${over ? "bg-brand text-n-50" : "bg-n-150 text-n-800"}`}><Icon name="upload" size={22} /></span>
        <p className="text-sm">
          Drag &amp; drop or{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-semibold text-brand underline-offset-2 hover:underline">choose files</button>{" "}
          to upload
        </p>
        <p className="mt-1 text-xs text-muted">{hint ?? "Image, video, audio or PDF. Add as many as you like."}</p>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} value="" onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Uploading">
          {uploads.map((u) => {
            const pct = Math.round(u.progress * 100);
            return (
              <li key={u.id} className="rounded-xl bg-n-150 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand bg-white text-brand"><Icon name="brief" size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{u.name}</span>
                    <span className="block text-xs text-muted">{formatBytes(u.size)}{u.secondsLeft !== null && pct < 100 ? ` · ${u.secondsLeft <= 1 ? "almost done" : `${u.secondsLeft} seconds left`}` : ""}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">{pct}%</span>
                  <button type="button" onClick={() => onCancel(u.id)} aria-label={`Cancel upload of ${u.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white"><Icon name="x" size={16} /></button>
                </div>
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${u.name} upload`} className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-brand transition-[width] duration-150" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
