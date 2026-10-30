"use client";

import { Icon } from "./Icon";

/** Presentational star. The parent owns the favorites state so a long list makes one request, not one per row. */
export function StarButton({ starred, onToggle, label }: { starred: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      aria-pressed={starred}
      aria-label={starred ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
      title={starred ? "Remove from favorites" : "Add to favorites"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-tight hover:bg-n-150 ${starred ? "text-warn-fg" : "text-n-650"}`}
    >
      <span className={starred ? "[&_path]:fill-current" : ""}><Icon name="star" size={18} /></span>
    </button>
  );
}
