"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { repo } from "@/lib/data";
import type { Asset, Person, User } from "@/lib/types";

const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

type Row = { id: string; name: string; email?: string; role: "Owner" | "Approver" | "Reviewer" };

export const reviewLink = (asset: Pick<Asset, "id">) => `${window.location.origin}/review/${asset.id}`;

/** Copies text; falls back to a hidden field where the clipboard API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

function rowsOf(asset: Asset, users: User[]): Row[] {
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name;
  const rows: Row[] = [];
  if (asset.submittedBy) rows.push({ id: asset.submittedBy, name: nameOf(asset.submittedBy) ?? "The person who sent it", role: "Owner" });
  const seen = new Set(rows.map((r) => r.id));
  for (const p of asset.approvers ?? []) if (!seen.has(p.id)) { seen.add(p.id); rows.push({ id: p.id, name: p.name, email: p.email, role: "Approver" }); }
  for (const p of asset.reviewers ?? []) if (!seen.has(p.id)) { seen.add(p.id); rows.push({ id: p.id, name: p.name, email: p.email, role: "Reviewer" }); }
  return rows;
}

/** Google-style share: add people, see who has access, set what the link allows, copy it. */
export function ShareDialog({ asset, users, canManage, onClose, onChange }: { asset: Asset; users: User[]; canManage: boolean; onClose: () => void; onChange: (a: Asset) => void }) {
  const [adding, setAdding] = useState<Person[]>([]);
  const [role, setRole] = useState<"reviewer" | "approver">("reviewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const run = async (fn: () => Promise<Asset>) => {
    setBusy(true); setError("");
    try { onChange(await fn()); return true; } catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); return false; } finally { setBusy(false); }
  };

  const add = async () => {
    if (!adding.length) return;
    if (await run(() => repo.share(asset.id, { add: adding.map((person) => ({ person, role })) }))) setAdding([]);
  };

  const copy = async () => {
    setCopied(await copyText(reviewLink(asset)));
    setTimeout(() => setCopied(false), 2000);
  };

  const rows = rowsOf(asset, users);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Share ${asset.name}`} onMouseDown={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-loose border border-line bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">Share “{asset.name}”</h2>

        {canManage && (
          <div className="mt-4">
            <PeoplePicker label="Add people" value={adding} onChange={setAdding} placeholder="Search by name" />
            {adding.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">As
                  <select value={role} onChange={(e) => setRole(e.target.value as "reviewer" | "approver")} className="rounded-tight border border-control bg-white px-2 py-2 text-sm">
                    <option value="reviewer">Reviewer (can comment)</option>
                    <option value="approver">Approver (can also approve)</option>
                  </select>
                </label>
                <button onClick={add} disabled={busy} className="btn btn-md btn-primary ml-auto">{busy ? "Adding…" : "Add"}</button>
              </div>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-bad-fg">{error}</p>}

        <h3 className="mb-2 mt-6 text-sm font-bold">People with access</h3>
        <ul className="max-h-64 divide-y divide-line overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-4 py-2">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-round bg-brand-dark text-xs font-bold text-n-50">{initialsOf(r.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                {r.email && <span className="block truncate text-xs text-muted">{r.email}</span>}
              </span>
              <span className="text-sm text-muted">{r.role}</span>
              {canManage && r.role !== "Owner" && (
                <button onClick={() => run(() => repo.share(asset.id, { remove: [r.id] }))} disabled={busy} aria-label={`Remove ${r.name}`} className="flex h-8 w-8 items-center justify-center rounded-round hover:bg-n-150 disabled:opacity-40"><Icon name="x" size={14} /></button>
              )}
            </li>
          ))}
        </ul>

        <h3 className="mb-2 mt-6 text-sm font-bold">General access</h3>
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-round ${asset.linkAccess ? "bg-brand-soft text-brand" : "bg-n-150 text-n-800"}`}><Icon name={asset.linkAccess ? "users" : "eyeOff"} size={18} /></span>
          <span className="min-w-0 flex-1">
            {canManage ? (
              <select
                aria-label="Who can open the link"
                value={asset.linkAccess ? "link" : "restricted"}
                disabled={busy}
                onChange={(e) => run(() => repo.share(asset.id, { linkAccess: e.target.value === "link" }))}
                className="-ml-2 rounded-tight border border-transparent bg-transparent px-2 py-0 text-sm font-medium hover:bg-n-150"
              >
                <option value="restricted">Restricted</option>
                <option value="link">Anyone at SurveyMonkey with the link</option>
              </select>
            ) : <span className="text-sm font-medium">{asset.linkAccess ? "Anyone at SurveyMonkey with the link" : "Restricted"}</span>}
            <span className="block text-xs text-muted">{asset.linkAccess ? "Anyone signed in to the Hub can open this and comment." : "Only the people above can open this with the link."}</span>
          </span>
        </div>

        <div className="mt-6 flex items-center">
          <button onClick={copy} className="btn btn-md btn-secondary">
            <Icon name={copied ? "check" : "link"} size={16} /> {copied ? "Link copied" : "Copy link"}
          </button>
          <button ref={closeBtn} onClick={onClose} className="btn btn-md btn-primary ml-auto">Done</button>
        </div>
      </div>
    </div>
  );
}
