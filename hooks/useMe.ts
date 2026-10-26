"use client";

import { useEffect, useState } from "react";
import { isJira } from "@/lib/data/mode";

export type Me = { id: string; name: string; email?: string; role: "creative" | "requester"; isAdmin: boolean };

const DEMO: Me = { id: "u-avery", name: "Avery Chen", role: "creative", isAdmin: true };

/** Who is signed in. Real mode asks the server; demo mode is a fixed demo person. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(isJira ? null : DEMO);
  useEffect(() => {
    if (!isJira) return;
    let live = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (live && m) setMe({ id: m.accountId, name: m.name, email: m.email, role: m.role, isAdmin: !!m.isAdmin }); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return me;
}
