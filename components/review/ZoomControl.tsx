"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ZOOM_STEPS, type Zoom } from "./Stage";

/** Zoom dropdown in the style of Google Slides: Fit, then fixed percentages. */
export function ZoomControl({ zoom, onChange }: { zoom: Zoom; onChange: (z: Zoom) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const options: Zoom[] = ["fit", ...ZOOM_STEPS];
  const label = (z: Zoom) => (z === "fit" ? "Fit" : `${z}%`);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Zoom: ${label(zoom)}`}
        className="flex items-center gap-2 rounded-full border border-control bg-white py-2 pl-4 pr-2 text-sm hover:bg-n-150"
      >
        <Icon name="search" size={14} />
        <span className="w-9 text-left">{label(zoom)}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <ul role="listbox" aria-label="Zoom" className="absolute left-0 top-full z-20 mt-2 w-32 rounded-xl border border-line bg-white p-2 shadow-lg">
          {options.map((z) => (
            <li key={z} role="option" aria-selected={z === zoom}>
              {z !== "fit" && z === ZOOM_STEPS[0] && <div className="mx-2 my-2 border-t border-line" />}
              <button
                onClick={() => { onChange(z); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-4 py-2 text-left text-sm ${z === zoom ? "bg-n-150 font-medium" : "hover:bg-n-150"}`}
              >
                <span className="w-4">{z === zoom && <Icon name="check" size={14} />}</span>
                {label(z)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
