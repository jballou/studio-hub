"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type Zoom = "fit" | number;
export const ZOOM_STEPS = [50, 75, 90, 100, 125, 150, 200] as const;

/**
 * Sizes a fixed-aspect box inside the available area. Annotation coordinates are
 * normalized against this box, so the media and overlay must share it exactly.
 * "fit" shrinks or grows the box to fill the area; a percentage is relative to
 * `baseWidth` (the asset's natural width) and scrolls when larger than the area.
 */
export function Stage({
  aspect, zoom = "fit", baseWidth = 1280, reserve = 0, children,
}: {
  aspect: number;
  zoom?: Zoom;
  baseWidth?: number;
  /** px kept clear at the bottom for something floating over the area, such as player controls */
  reserve?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setArea({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safe = aspect > 0 ? aspect : 1;
  let size: { w: number; h: number };
  if (zoom === "fit") {
    size = area.h > 0 && area.w / area.h > safe ? { w: area.h * safe, h: area.h } : { w: area.w, h: area.w / safe };
  } else {
    const w = (baseWidth * zoom) / 100;
    size = { w, h: w / safe };
  }

  return (
    <div ref={ref} className="flex min-h-0 min-w-0 flex-1 overflow-auto p-2" style={reserve ? { paddingBottom: reserve + 8 } : undefined}>
      <div className="relative m-auto shrink-0 bg-white shadow-md" style={{ width: size.w, height: size.h }}>
        {children}
      </div>
    </div>
  );
}
