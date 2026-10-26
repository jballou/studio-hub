"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fits a fixed-aspect box inside the available area. Annotation coordinates are
 * normalized against this box, so the media and overlay must share it exactly.
 */
export function Stage({ aspect, children }: { aspect: number; children: ReactNode }) {
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
  const fit = area.h > 0 && area.w / area.h > safe
    ? { w: area.h * safe, h: area.h }
    : { w: area.w, h: area.w / safe };

  return (
    <div ref={ref} className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
      <div className="relative bg-white shadow-md" style={{ width: fit.w, height: fit.h }}>
        {children}
      </div>
    </div>
  );
}
