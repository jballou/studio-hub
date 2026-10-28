"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Callout, Tag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { googleRepo, isJira, type GoogleStatus } from "@/lib/data";
import { ShaderBackground } from "./ShaderBackground";

const DONE_KEY = "hub-welcome-done";
const safePath = (p: string | null) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/projects");

const FLASH: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "Google is connected." },
  denied: { tone: "warn", text: "Google wasn't connected because the request was cancelled." },
  partial: { tone: "warn", text: "Google needs both permissions (calendar and tasks). Connect again and leave both ticked." },
  "wrong-account": { tone: "bad", text: "Use your @surveymonkey.com Google account." },
  failed: { tone: "bad", text: "Something went wrong connecting Google. Try again." },
  "not-configured": { tone: "warn", text: "Google isn't set up for this app yet. An admin needs to add the Google client credentials." },
};

/** First-run step after signing in: optionally connect Google, see whether Figma is ready, then go on. */
export function Welcome() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safePath(params.get("next"));
  const flash = FLASH[params.get("google") ?? ""];
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [figma, setFigma] = useState<boolean | null>(null);
  const [skipChecked, setSkipChecked] = useState(false);

  useEffect(() => {
    // People who've been through this step go straight on, unless they just came back from Google.
    let done = false;
    try { done = localStorage.getItem(DONE_KEY) === "1"; } catch { /* storage unavailable */ }
    if (done && !params.get("google")) { router.replace(next); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkipChecked(true);
    googleRepo.status().then(setGoogle).catch(() => setGoogle({ configured: false, connected: false }));
    if (isJira) fetch("/api/figma/status", { cache: "no-store" }).then((r) => r.json()).then((b) => setFigma(!!b.configured)).catch(() => setFigma(false));
    else setFigma(true);
  }, [next, params, router]);

  const go = () => {
    try { localStorage.setItem(DONE_KEY, "1"); } catch { /* storage unavailable */ }
    router.push(next);
  };

  if (!skipChecked) return <ShaderBackground />;

  return (
    <>
      <ShaderBackground />
      <main className="grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl [html[data-theme=dark]_&]:border-white/10 [html[data-theme=dark]_&]:bg-[#151c18]/80">
          <Logo size={48} className="mb-4 shadow-md" />
          <h1 className="text-2xl font-bold">You&apos;re in. Connect your tools?</h1>
          <p className="mb-6 mt-2 text-sm text-muted">Optional, and you can do it later from My Day.</p>
          {flash && <div className="mb-4"><Callout tone={flash.tone} icon={flash.tone === "ok" ? "check" : "alert"}>{flash.text}</Callout></div>}

          <ul className="space-y-4">
            <li className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
              <span className="mt-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info-fg"><Icon name="calendar" size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Google Calendar and Tasks</h2>
                <p className="text-sm text-muted">See today&apos;s meetings on My Day, and back up your own tasks to a Google Tasks list. The app only reads your calendar.</p>
                <div className="mt-2">
                  {google === null ? <span className="text-sm text-muted">Checking…</span>
                    : google.connected ? <Tag tone="ok" icon="check">Connected as {google.googleEmail}</Tag>
                    : google.configured ? <a href="/api/google/connect?return=welcome" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark">Connect Google</a>
                    : <Tag tone="warn" icon="alert">Not set up yet. Ask an admin.</Tag>}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
              <span className="mt-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-progress-bg text-progress-fg"><Icon name="link" size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Figma</h2>
                <p className="text-sm text-muted">Connected once for the whole team, so there&apos;s nothing for you to do. It lets you pick frames with thumbnails when you submit for feedback.</p>
                <div className="mt-2">
                  {figma === null ? <span className="text-sm text-muted">Checking…</span>
                    : figma ? <Tag tone="ok" icon="check">Ready for the team</Tag>
                    : <Tag tone="warn" icon="alert">Not set up yet. You can still paste frame links.</Tag>}
                </div>
              </div>
            </li>
          </ul>

          <div className="mt-6 flex items-center gap-4">
            <button onClick={go} className="rounded-xl bg-brand px-6 py-4 text-base font-semibold text-n-50 hover:bg-brand-dark">{google?.connected ? "Continue" : "Continue for now"}</button>
            {!google?.connected && <button onClick={go} className="text-sm font-medium text-muted underline hover:text-ink">Skip</button>}
          </div>
        </div>
      </main>
    </>
  );
}
