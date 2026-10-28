"use client";

import { useEffect, useRef, useState } from "react";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { Callout } from "@/components/ui/Tag";
import { blocksRepo } from "@/lib/data/blocks";
import type { Block, Person } from "@/lib/types";

/** Name who a ticket is waiting on and why. Also used to re-point an existing block. */
export function BlockDialog({
  ticketKey, existing, onClose, onSaved,
}: {
  ticketKey: string;
  existing?: Block;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [who, setWho] = useState<Person[]>(existing ? [existing.blockedBy] : []);
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { jira } = await blocksRepo.block(ticketKey, who[0], reason);
      if (jira && !jira.ok) {
        // Saved here, but Jira's status didn't change: say so instead of closing silently.
        setNotice(jira.reason);
        setBusy(false);
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Blocked: ${ticketKey}`}
        className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{existing ? "Change who it\u2019s waiting on" : "Mark as blocked"}</h2>
        <p className="mb-4 mt-2 text-sm text-muted">{ticketKey}. They&apos;ll get a notification and a list of everything waiting on them.</p>
        <div className="space-y-4">
          <PeoplePicker label="Blocked by" value={who} onChange={setWho} max={1} placeholder="Search by name" />
          <label className="block text-sm font-semibold">What do they need to do?
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sign off on the legal claim in the headline."
              className="mt-2 w-full rounded-lg border border-control bg-white px-4 py-2 text-sm font-normal"
            />
          </label>
          <p className="text-xs text-muted">The ticket&apos;s status in Jira moves to Blocked too, and goes back when the block is cleared.</p>
          {error && <Callout tone="bad" icon="alert">{error}</Callout>}
          {notice && <Callout tone="warn" icon="alert">Saved here, but Jira&apos;s status didn&apos;t change. {notice}</Callout>}
          {notice ? (
            <button onClick={onSaved} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Done</button>
          ) : (
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !who.length || !reason.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">
              {busy ? "Saving…" : existing ? "Save" : "Mark as blocked"}
            </button>
            <button onClick={onClose} className="rounded-lg border border-control px-4 py-2 text-sm font-medium hover:bg-brand-soft">Cancel</button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
