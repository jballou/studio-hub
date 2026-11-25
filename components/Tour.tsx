"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { START_TOUR } from "./HelpDialog";

type Step = { target: string; title: string; body: string };

/** Chrome's install prompt, captured early by the script in the layout. It exists only on Chrome and Edge, when the Hub is installable and not yet installed. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const installPrompt = () => (window as unknown as { __hubInstall?: InstallPrompt | null }).__hubInstall ?? null;
const INSTALL: Step = { target: "install", title: "Install the Hub as an app", body: "Click Install in the address bar, up at the top right of Chrome. The Hub opens in its own window with its own icon in your dock, so it never gets lost among your tabs." };

const STEPS: Step[] = [
  { target: "new-project", title: "Start something new", body: "New project is always up here. Use it to ask for creative work, or to share designs and get feedback." },
  { target: "projects", title: "Track your projects", body: "Everything you have asked for lives in Projects. Open one to see its status, dates and comments. Star it to pin it under Favorites." },
  { target: "review", title: "Give feedback when it's asked for", body: "When someone wants your feedback you get a notification on the bell. Open the design from there or from Review, comment right on it, then approve or ask for changes." },
  { target: "blocking", title: "Clear blockers", body: "When a project is stuck on you, it shows here with a red count. Read what's needed, do it, then press “I've unblocked this” so the team can keep moving." },
  { target: "help", title: "Need a hand?", body: "Help has the Slack channel, the guide, and this tour any time you want to see it again." },
];

const PAD = 8;
type Box = { top: number; left: number; width: number; height: number };

/** A spotlight walkthrough. Dims the page, cuts a hole around one element at a time and explains it. Started by the Help dialog. */
export function Tour() {
  const [i, setI] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [steps, setSteps] = useState<(Step & { el: Element | null })[]>([]);

  const start = useCallback(() => {
    // Only steps whose element is on screen right now (the sidebar items differ by role).
    const found = STEPS.flatMap((s) => { const el = document.querySelector(`[data-tour="${s.target}"]`); return el ? [{ ...s, el }] : []; });
    // The install step has nothing on the page to point at: it points up at Chrome's address bar, and only when Chrome is offering the button.
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const withInstall = installPrompt() && !standalone ? [...found, { ...INSTALL, el: null }] : found;
    if (withInstall.length === 0) return;
    setSteps(withInstall);
    setI(0);
  }, []);
  useEffect(() => {
    window.addEventListener(START_TOUR, start);
    return () => window.removeEventListener(START_TOUR, start);
  }, [start]);

  const step = i === null ? null : steps[i];
  const measure = useCallback(() => {
    if (!step?.el) return;
    const r = step.el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);
  useLayoutEffect(() => {
    // The New project button scrolls away with the page, so bring the element into view first.
    step?.el?.scrollIntoView({ block: "nearest", behavior: "instant" });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [measure, step]);

  const close = useCallback(() => { setI(null); setBox(null); }, []);
  useEffect(() => {
    if (i === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setI((n) => (n === null ? n : Math.min(n + 1, steps.length - 1)));
      else if (e.key === "ArrowLeft") setI((n) => (n === null ? n : Math.max(n - 1, 0)));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [i, steps.length, close]);

  if (i === null || !step) return null;
  const last = i === steps.length - 1;
  if (step.target === "install") return <InstallStep i={i} total={steps.length} last={last} step={step} onBack={() => setI(i - 1)} onClose={close} />;
  if (!box) return null;
  const W = 320;
  // Beside the element when it sits in the left sidebar, below it when it is up in the bar.
  const inSidebar = box.left < 320;
  const left = inSidebar ? box.left + box.width + 16 : Math.max(16, Math.min(window.innerWidth - W - 16, box.left + box.width - W));
  const top = inSidebar ? Math.max(16, Math.min(window.innerHeight - 240, box.top + box.height / 2 - 80)) : box.top + box.height + 16;

  return (
    <div className="fixed inset-0 z-[70]" onMouseDown={close}>
      <div aria-hidden="true" className="pointer-events-none fixed rounded-tight motion-safe:transition-all motion-safe:duration-200" style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgb(20 28 24 / 0.6)" }} />
      <div
        role="dialog" aria-modal="true" aria-label={`Tour, step ${i + 1} of ${steps.length}`}
        onMouseDown={(e) => e.stopPropagation()}
        className="fixed rounded-loose border border-line bg-white p-4 shadow-xl"
        style={{ top, left, width: W }}
      >
        <p className="text-muted eyebrow">Step {i + 1} of {steps.length}</p>
        <h2 className="mt-2 font-bold">{step.title}</h2>
        <p className="mt-2 text-sm text-muted">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={close} className="text-sm font-medium text-muted underline hover:text-ink">{last ? "Close" : "Skip"}</button>
          <span className="flex-1" />
          {i > 0 && <button onClick={() => setI(i - 1)} className="btn btn-sm btn-secondary">Back</button>}
          <button onClick={() => (last ? close() : setI(i + 1))} autoFocus className="btn btn-sm btn-primary">{last ? "Done" : "Next"}{!last && <Icon name="chevronRight" size={14} />}</button>
        </div>
      </div>
    </div>
  );
}

/** Dims the page and points up at the browser's address bar, where Chrome shows its Install button. The button itself belongs to the browser, so the arrow aims at where it usually sits. */
function InstallStep({ i, total, last, step, onBack, onClose }: { i: number; total: number; last: boolean; step: Step; onBack: () => void; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const install = async () => {
    const p = installPrompt();
    if (!p) { setNote("Chrome isn't offering the install button right now. Look for Install in the address bar."); return; }
    try {
      await p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === "accepted") { (window as unknown as { __hubInstall: null }).__hubInstall = null; onClose(); }
    } catch { setNote("Couldn't open the install prompt. Click Install in the address bar instead."); }
  };
  return (
    <div className="fixed inset-0 z-[70] bg-[rgb(20_28_24/0.6)]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Tour, step ${i + 1} of ${total}`} onMouseDown={(e) => e.stopPropagation()} className="fixed right-4 top-4 w-80 max-w-[calc(100vw-2rem)]">
        <span aria-hidden="true" className="mr-16 flex justify-end text-n-50 motion-safe:animate-bounce"><span className="rotate-180"><Icon name="arrowDown" size={32} /></span></span>
        <div className="rounded-loose border border-line bg-white p-4 shadow-xl">
          <p className="text-muted eyebrow">Step {i + 1} of {total}</p>
          <h2 className="mt-2 font-bold">{step.title}</h2>
          <p className="mt-2 text-sm text-muted">{step.body}</p>
          {note && <p role="status" className="mt-2 text-sm text-bad-fg">{note}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={onClose} className="text-sm font-medium text-muted underline hover:text-ink">{last ? "Close" : "Skip"}</button>
            <span className="flex-1" />
            {i > 0 && <button onClick={onBack} className="btn btn-sm btn-secondary">Back</button>}
            <button onClick={install} autoFocus className="btn btn-sm btn-primary"><Icon name="download" size={14} />Install now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
