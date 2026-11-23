"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Tag";
import { isJira } from "@/lib/data/mode";
import { FONT_LICENSE, FONT_LICENSE_VERSION } from "@/lib/brand/license";
import { useMe } from "@/hooks/useMe";

/** The Download button on Typography. It opens the license terms; the file is only sent after the person accepts them. */
export function FontDownload() {
  const me = useMe();
  const dlg = useRef<HTMLDialogElement>(null);
  const [available, setAvailable] = useState<boolean | null>(isJira ? null : true);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isJira) return;
    fetch("/api/brand/fonts", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((b) => setAvailable(!!b?.available)).catch(() => setAvailable(false));
  }, []);

  const open = () => { setAgreed(false); setError(null); setDone(false); dlg.current?.showModal(); };
  const close = () => dlg.current?.close();

  async function download() {
    setBusy(true); setError(null);
    try {
      if (!isJira) throw new Error("The demo has no font file. Once sign-in is on, your acceptance is recorded and the download starts.");
      const r = await fetch("/api/brand/fonts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree: true, version: FONT_LICENSE_VERSION }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `The download failed (${r.status}).`);
      const name = /filename\*=UTF-8''([^;]+)/.exec(r.headers.get("content-disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name ? decodeURIComponent(name) : "National-2-fonts.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The download failed.");
    }
    setBusy(false);
  }

  const off = available === false;
  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={open} disabled={available === null || off} className="btn btn-md btn-secondary"><Icon name="download" size={16} /> Download font</button>
        {off && <span className="text-xs text-muted">{me?.isAdmin ? "Add the font file in Preferences, Brand library." : "Not available yet."}</span>}
      </div>

      <dialog ref={dlg} aria-labelledby="lic-h" className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-loose border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/40" onClose={() => setBusy(false)}>
        <div className="flex max-h-[min(90dvh,48rem)] flex-col">
          <header className="border-b border-line p-6">
            <h2 id="lic-h" className="text-xl font-bold">{FONT_LICENSE.title}</h2>
            <p className="mt-2 text-sm text-muted">{FONT_LICENSE.subtitle} · Version {FONT_LICENSE_VERSION}</p>
          </header>

          <div role="region" aria-label="License terms" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto bg-n-100 px-6 py-4">
            <p className="text-sm">{FONT_LICENSE.intro}</p>
            <ol className="mt-4 space-y-4">
              {FONT_LICENSE.sections.map((s) => (
                <li key={s.n} className="text-sm">
                  <h3 className="font-bold">{s.n}. {s.title}</h3>
                  {s.body.map((p, i) => <p key={i} className="mt-2 text-n-800">{p}</p>)}
                </li>
              ))}
            </ol>
          </div>

          <footer className="border-t border-line p-6">
            {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
            {done && <div className="mb-4"><Callout tone="ok" icon="check">Your download has started. Your acceptance was recorded.</Callout></div>}
            <label className="flex items-start gap-4 text-sm font-medium">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-2 h-4 w-4 shrink-0 accent-brand" />
              <span>{FONT_LICENSE.agreement}</span>
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button onClick={close} className="btn btn-md btn-secondary">{done ? "Close" : "Cancel"}</button>
              {!done && <button onClick={download} disabled={!agreed || busy} className="btn btn-md btn-primary"><Icon name="download" size={16} /> {busy ? "Preparing…" : "Agree and download"}</button>}
            </div>
          </footer>
        </div>
      </dialog>
    </>
  );
}
