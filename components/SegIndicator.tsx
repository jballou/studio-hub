"use client";

import { useEffect } from "react";

const ON = '[aria-pressed="true"], [aria-selected="true"], [aria-current="true"]';

/**
 * Keeps the green highlight of every segmented control (.seg) under its selected item, so it slides between choices
 * instead of jumping. The highlight itself is drawn by CSS (.seg::before) from the --seg-x / --seg-w values set here.
 */
export function SegIndicator() {
  useEffect(() => {
    let raf = 0;
    const place = () => {
      raf = 0;
      document.querySelectorAll<HTMLElement>(".seg").forEach((seg) => {
        const on = seg.querySelector<HTMLElement>(`.seg-item:is(${ON})`);
        if (!on) { seg.style.setProperty("--seg-on", "0"); return; }
        seg.style.setProperty("--seg-x", `${on.offsetLeft}px`);
        seg.style.setProperty("--seg-w", `${on.offsetWidth}px`);
        seg.style.setProperty("--seg-on", "1");
        // Turn the slide on after the first placement, so a control doesn't animate in from the left on load.
        if (!seg.dataset.ready) requestAnimationFrame(() => { seg.dataset.ready = "1"; });
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected", "aria-current", "class"] });
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    document.fonts?.addEventListener?.("loadingdone", schedule);
    schedule();
    return () => { mo.disconnect(); window.removeEventListener("resize", schedule); document.fonts?.removeEventListener?.("loadingdone", schedule); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
