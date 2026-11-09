"use client";

import { useEffect, useState } from "react";
import { isJira } from "@/lib/data/mode";
import { sampleMirror } from "@/lib/okr/sample";
import type { Kr } from "@/lib/okr/types";

type State = { krs: Kr[]; ready: boolean; sample: boolean };
const DEMO: State = { krs: sampleMirror().krs, ready: true, sample: true };

// Pickers and chips on one page share a single request, remembered for a minute.
let shared: { at: number; p: Promise<{ krs: Kr[]; sample: boolean }> } | null = null;
function load() {
  if (shared && Date.now() - shared.at < 60_000) return shared.p;
  const p = fetch("/api/okr", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { krs: [] }))
    .then((b) => ({ krs: Array.isArray(b.krs) ? (b.krs as Kr[]) : [], sample: !!b.sample }))
    .catch(() => ({ krs: [] as Kr[], sample: false }));
  shared = { at: Date.now(), p };
  return p;
}

/** The synced key results. Demo mode uses the built-in sample. Empty before the first OKR sync or if the request fails. `ready` flips once the answer is in. */
export function useOkr(): State {
  const [state, setState] = useState<State>(isJira ? { krs: [], ready: false, sample: false } : DEMO);
  useEffect(() => {
    if (!isJira) return;
    let live = true;
    load().then((r) => { if (live) setState({ ...r, ready: true }); });
    return () => { live = false; };
  }, []);
  return state;
}
