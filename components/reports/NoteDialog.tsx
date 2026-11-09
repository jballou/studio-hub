"use client";

import { useEffect, useRef, useState } from "react";
import { Callout } from "@/components/ui/Tag";
import { meRepo } from "@/lib/data";
import type { Note, NoteType } from "@/lib/me/types";
import { NOTE_TYPES } from "./noteMeta";

/** A quick private note: pick a kind, write a line. It feeds your weekly report and nobody else sees it. */
export function NoteDialog({ onClose, onSaved }: { onClose: () => void; onSaved?: (n: Note) => void }) {
  const [type, setType] = useState<NoteType>("win");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    box.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // Saved first: `onSaved?.(await …)` would skip the save entirely when there is no onSaved.
      const note = await meRepo.addNote({ type, text });
      onSaved?.(note);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the note.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add a note" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-loose border border-line bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">Add a note</h2>
        <p className="mt-2 text-sm text-muted">Private to you. It goes into your weekly report.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Kind of note">
          {NOTE_TYPES.map((t) => <button key={t.id} type="button" onClick={() => setType(t.id)} aria-pressed={type === t.id} title={t.hint} className="chip">{t.label}</button>)}
        </div>
        <label className="mt-4 block text-sm font-bold">What happened?
          <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} className="mt-2 block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal" />
        </label>
        {error && <div className="mt-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-md btn-secondary">Cancel</button>
          <button onClick={save} disabled={busy || !text.trim()} className="btn btn-md btn-primary">{busy ? "Saving…" : "Save note"}</button>
        </div>
      </div>
    </div>
  );
}
