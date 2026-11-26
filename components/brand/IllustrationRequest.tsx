"use client";

import { CloseButton } from "@/components/ui/CloseButton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { IllustrationSteps } from "./IllustrationSteps";

/** The "Request an illustration" button and the dialog that explains the process before starting a request. */
export function IllustrationRequest({ variant = "primary" }: { variant?: "primary" | "link" }) {
  const [open, setOpen] = useState(false);
  const start = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    start.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <>
      {variant === "primary"
        ? <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="btn btn-md btn-primary"><Icon name="plus" size={16} />Request an illustration</button>
        : <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="font-medium text-brand underline-offset-2 hover:underline">Request an illustration</button>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ill-req-title" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-loose border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 id="ill-req-title" className="text-xl font-bold">Request an illustration</h2>
                <p className="mt-2 text-sm text-muted">Here&apos;s how illustration requests work.</p>
              </div>
              <CloseButton onClick={() => setOpen(false)} />
            </div>
            <div className="mt-6"><IllustrationSteps /></div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn btn-md btn-secondary">Back to the library</button>
              <Link ref={start} href="/projects/new/illustration" className="btn btn-md btn-primary">Start a request<Icon name="chevronRight" size={16} /></Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
