"use client";

import { useEffect, useState } from "react";

export type WallItem = { id: string; name: string; mimeType: string; size?: number; width?: number; height?: number };
type Kind = "photos" | "illustrations";

/** A few big images from the full-bleed retouched folder, edge to edge in a varied grid. Click one to open it. */
// Eight tiles that fill a 4 x 4 block exactly, so the grid has no gaps.
const SHAPES = ["md:col-span-2 md:row-span-2", "md:row-span-2", "", "", "md:row-span-2", "md:col-span-2 md:row-span-2", "", ""];

export function InspirationWall({ kind, onOpen }: { kind: Kind; onOpen: (i: WallItem) => void }) {
  const [items, setItems] = useState<WallItem[] | null>(null);
  useEffect(() => {
    fetch(`/api/brand/drive/wall?kind=${kind}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setItems(Array.isArray(b?.items) ? b.items : []))
      .catch(() => setItems([]));
  }, [kind]);

  if (!items || items.length < 8) return null;
  return (
    <section aria-label="Inspiration" className="mb-8">
      <ul className="-mx-4 grid auto-rows-[14rem] grid-cols-2 grid-flow-dense gap-2 md:-mx-8 md:auto-rows-[16rem] md:grid-cols-4">
        {items.map((i, n) => (
          <li key={i.id} className={`${SHAPES[n % SHAPES.length]} motion-safe:animate-[wall-in_480ms_ease-out_both]`} style={{ animationDelay: `${n * 60}ms` }}>
            <button onClick={() => onOpen(i)} aria-label={`Preview ${i.name}`} className={`group block h-full w-full overflow-hidden rounded-tight ${i.mimeType === "image/png" ? "checker" : "bg-n-150"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/brand/drive/file/${i.id}?kind=${kind}&mode=thumb&s=1000`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
