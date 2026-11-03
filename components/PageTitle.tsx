"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The page's title. It is drawn in the top bar (the #page-title slot) so the page body starts with content, and a
 * visually hidden h1 stays in the page for screen readers and for the first paint before the bar is ready.
 */
export function PageTitle({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlot(document.getElementById("page-title"));
  }, []);
  return (
    <>
      <h1 className="sr-only">{children}</h1>
      {slot && createPortal(<span aria-hidden="true">{children}</span>, slot)}
    </>
  );
}
