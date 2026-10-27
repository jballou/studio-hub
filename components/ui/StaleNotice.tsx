"use client";

import { useEffect, useState } from "react";
import { Callout } from "./Tag";
import { STALE_EVENT } from "@/lib/data/jira";

/** Shown when Jira was rate-limiting and the page is showing a slightly older copy. Clears itself after a minute. */
export function StaleNotice() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = () => { setStale(true); clearTimeout(t); t = setTimeout(() => setStale(false), 60_000); };
    window.addEventListener(STALE_EVENT, on);
    return () => { window.removeEventListener(STALE_EVENT, on); clearTimeout(t); };
  }, []);
  if (!stale) return null;
  return <div className="mb-4"><Callout tone="warn" icon="alert">Jira is busy, so this may be a minute behind. It will catch up on its own.</Callout></div>;
}
