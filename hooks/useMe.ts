"use client";

import { useEffect, useState } from "react";
import { isJira } from "@/lib/data/mode";

export type Me = { id: string; name: string; email?: string; role: "creative" | "requester"; isAdmin: boolean; isLead: boolean };

const DEMO: Me = { id: "u-avery", name: "Avery Chen", role: "creative", isAdmin: true, isLead: true };

// Seven components ask "who am I" on a page. They share one request, remembered for a minute.
let shared: { at: number; p: Promise<Me | null> } | null = null;
function loadMe(): Promise<Me | null> {
  if (shared && Date.now() - shared.at < 60_000) return shared.p;
  const p = fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((m): Me | null => (m ? { id: m.accountId, name: m.name, email: m.email, role: m.role, isAdmin: !!m.isAdmin, isLead: !!m.isLead } : null))
    .catch(() => null);
  shared = { at: Date.now(), p };
  // Don't remember a failure.
  p.then((m) => { if (!m && shared?.p === p) shared = null; });
  return p;
}

/** Who is signed in. Real mode asks the server; demo mode is a fixed demo person. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(isJira ? null : DEMO);
  useEffect(() => {
    if (!isJira) return;
    let live = true;
    loadMe().then((m) => { if (live && m) setMe(m); });
    return () => { live = false; };
  }, []);
  return me;
}
