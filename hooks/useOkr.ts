"use client";

import { useEffect, useState } from "react";
import { isJira } from "@/lib/data/mode";
import type { Kr } from "@/lib/okr/types";

// Pickers and chips on one page share a single request, remembered for a minute.
let shared: { at: number; p: Promise<Kr[]> } | null = null;
function loadKrs(): Promise<Kr[]> {
  if (shared && Date.now() - shared.at < 60_000) return shared.p;
  const p = fetch("/api/okr", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { krs: [] }))
    .then((b): Kr[] => (Array.isArray(b.krs) ? b.krs : []))
    .catch(() => [] as Kr[]);
  shared = { at: Date.now(), p };
  return p;
}

/** The synced key results. Empty in demo mode, before the first OKR sync, or if the request fails. `ready` flips once the answer is in. */
export function useOkr(): { krs: Kr[]; ready: boolean } {
  const [state, setState] = useState<{ krs: Kr[]; ready: boolean }>({ krs: [], ready: !isJira });
  useEffect(() => {
    if (!isJira) return;
    let live = true;
    loadKrs().then((krs) => { if (live) setState({ krs, ready: true }); });
    return () => { live = false; };
  }, []);
  return state;
}
