"use client";

import { useEffect, useRef } from "react";

/** A small yes/no dialog for actions that deserve a second look. Esc or clicking outside cancels. */
export function ConfirmDialog({ title, body, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-loose border border-line bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancel} onClick={onCancel} className="btn btn-md btn-secondary">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className={`btn btn-md ${danger ? "btn-primary !bg-bad-fg" : "btn-primary"}`}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
