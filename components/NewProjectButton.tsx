"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { isJira } from "@/lib/data";
import { useMe } from "@/hooks/useMe";

const OPTIONS: { href: string; icon: IconName; title: string; body: string }[] = [
  { href: "/submit", icon: "upload", title: "Submit for feedback", body: "Share designs and get comments" },
  { href: "/projects/new", icon: "task", title: "New ticket", body: "Fill in a brief to request creative work" },
  { href: "/my-day?new=task", icon: "listChecks", title: "New personal task", body: "A private to-do on My Day" },
];

/** The green "+ New project" button in the top bar. Creatives pick what to start; requesters go straight to a new ticket. */
export function NewProjectButton() {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const creative = !isJira || me?.role === "creative";

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  if (!creative) {
    return <Link href="/projects/new" data-tour="new-project" className="btn btn-md btn-primary"><Icon name="plus" size={16} /> New project</Link>;
  }
  return (
    <>
      <button onClick={() => setOpen(true)} data-tour="new-project" aria-haspopup="dialog" className="btn btn-md btn-primary"><Icon name="plus" size={16} /> New project</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="new-project-title" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-loose border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 id="new-project-title" className="text-xl font-bold">New project</h2>
                <p className="mt-2 text-sm text-muted">What do you want to start?</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="btn btn-ghost btn-icon"><Icon name="close" size={18} /></button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {OPTIONS.map((o, i) => (
                <button
                  key={o.href}
                  ref={i === 0 ? first : undefined}
                  onClick={() => { setOpen(false); router.push(o.href); }}
                  className="group flex flex-col items-start gap-4 rounded-loose border border-control bg-white p-4 text-left hover:border-brand hover:bg-brand-soft/40"
                >
                  <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-round bg-n-150 text-n-800 group-hover:bg-brand group-hover:text-n-50"><Icon name={o.icon} size={22} /></span>
                  <span>
                    <span className="block font-bold">{o.title}</span>
                    <span className="mt-2 block text-sm text-muted">{o.body}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
