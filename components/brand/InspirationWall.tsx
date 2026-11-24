"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type WallItem = { id: string; name: string; mimeType: string; size?: number; width?: number; height?: number };
type Kind = "photos" | "illustrations";

/** A random spread from every folder, edge to edge, so people see what's possible before they go looking. Click one to open it. */
export function InspirationWall({ kind, title, onOpen }: { kind: Kind; title: string; onOpen: (i: WallItem) => void }) {
  const [items, setItems] = useState<WallItem[] | null>(null);
  const [round, setRound] = useState(0);

  const draw = useCallback(() => {
    fetch(`/api/brand/drive/wall?kind=${kind}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setItems(Array.isArray(b?.items) ? b.items : []))
      .catch(() => setItems([]));
  }, [kind]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!items || items.length < 6) return null;
  return (
    <section aria-labelledby="wall-h" className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="wall-h" className="text-lg font-bold">Get inspired</h2>
        <button onClick={() => { setRound((n) => n + 1); draw(); }} className="btn btn-sm btn-secondary"><Icon name="refresh" size={14} />Shuffle</button>
      </div>
      <ul key={round} className="-mx-4 columns-2 gap-2 md:-mx-8 sm:columns-3 lg:columns-4 xl:columns-6">
        {items.map((i, n) => {
          const ratio = i.width && i.height ? Math.min(2, Math.max(0.6, i.width / i.height)) : 4 / 3;
          return (
            <li key={i.id} className="mb-2 break-inside-avoid motion-safe:animate-[wall-in_480ms_ease-out_both]" style={{ animationDelay: `${Math.min(n, 12) * 40}ms` }}>
              <button onClick={() => onOpen(i)} aria-label={`Preview ${i.name}`} className={`group block w-full overflow-hidden rounded-tight ${i.mimeType === "image/png" ? "checker" : "bg-n-150"}`} style={{ aspectRatio: String(ratio) }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/brand/drive/file/${i.id}?kind=${kind}&mode=thumb&s=480`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">A random mix from every {title.toLowerCase()} folder. Shuffle for another.</p>
    </section>
  );
}
