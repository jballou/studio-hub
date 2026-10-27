"use client";

import { useEffect, useRef, useState } from "react";
import { Callout } from "@/components/ui/Tag";
import { blocksRepo, type TargetStatus } from "@/lib/data/blocks";
import { celebrate, isDeliveredStatus } from "@/lib/celebrate";
import type { JiraSync } from "@/lib/types";

/** Pick the Jira status a blocked ticket moves to. The list comes from what Jira allows for this ticket right now. */
export function UnblockDialog({
  ticketKey, previousStatus, onClose, onDone,
}: {
  ticketKey: string;
  /** Status the ticket had before it was blocked, offered as the default */
  previousStatus?: string;
  onClose: () => void;
  onDone: (result: { status: string; jira?: JiraSync }) => void;
}) {
  const [options, setOptions] = useState<TargetStatus[] | null>(null);
  const [picked, setPicked] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    blocksRepo.statuses(ticketKey)
      .then((s) => {
        if (!live) return;
        setOptions(s);
        const want = [previousStatus, "In Progress"].find((n) => n && s.some((x) => x.name.toLowerCase() === n.toLowerCase()));
        setPicked(s.find((x) => x.name.toLowerCase() === want?.toLowerCase())?.name ?? s.find((x) => x.category !== "done")?.name ?? s[0]?.name ?? "");
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load the statuses from Jira."));
    return () => { live = false; };
  }, [ticketKey, previousStatus]);

  useEffect(() => { if (options) ref.current?.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus(); }, [options]);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { jira } = await blocksRepo.resolve(ticketKey, note, picked);
      if (isDeliveredStatus(picked) && (!jira || jira.ok)) celebrate();
      onDone({ status: picked, jira });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't unblock.");
      setBusy(false);
    }
  };

  const group = (title: string, items: TargetStatus[]) => items.length > 0 && (
    <fieldset className="mb-3">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {items.map((s) => (
          <label key={s.name} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${picked === s.name ? "border-brand bg-brand-soft" : "border-control bg-white hover:bg-brand-soft"}`}>
            <input type="radio" name="status" checked={picked === s.name} onChange={() => setPicked(s.name)} className="accent-brand" />
            {s.name}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const closing = (options ?? []).filter((s) => s.category === "done");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-n-1000/40 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={`Unblock ${ticketKey}`} className="w-full max-w-lg rounded-xl border border-line bg-white p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Mark as unblocked</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{ticketKey}. Choose the Jira status it moves to.</p>
        {options === null && !error && <p className="text-sm text-muted">Loading statuses from Jira…</p>}
        {options && options.length === 0 && <Callout tone="warn" icon="alert">Jira doesn&apos;t offer any other status for this ticket right now.</Callout>}
        {options && (
          <>
            {group("Keep working", options.filter((s) => s.category !== "done"))}
            {group("Close it out", closing)}
            {closing.some((s) => s.name === picked) && <div className="mb-3"><Callout tone="warn" icon="alert">This closes the ticket in Jira.</Callout></div>}
            <label className="mb-3 block text-sm font-semibold">Note <span className="font-normal text-muted">(optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Approved in Slack" className="mt-1 w-full rounded-lg border border-control bg-white px-3 py-2 text-sm font-normal" />
            </label>
          </>
        )}
        {error && <div className="mb-3"><Callout tone="bad" icon="alert">{error}</Callout></div>}
        <div className="flex gap-2">
          <button onClick={go} disabled={busy || !picked} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">{busy ? "Updating…" : `Move to ${picked || "…"}`}</button>
          <button onClick={onClose} className="rounded-lg border border-control px-4 py-2 text-sm font-medium hover:bg-brand-soft">Cancel</button>
        </div>
      </div>
    </div>
  );
}
