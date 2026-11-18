"use client";

import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Callout, Tag } from "@/components/ui/Tag";
import { isJira } from "@/lib/data/mode";

type Overview = { config: { photos: string; illustrations: string; owner: string }; google: { configured: boolean; connected: boolean; canReadDrive: boolean } };

export function AdminBrand() {
  const [data, setData] = useState<Overview | null>(null);
  const [photos, setPhotos] = useState("");
  const [illustrations, setIllustrations] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const apply = (d: Overview) => { setData(d); setPhotos(d.config.photos); setIllustrations(d.config.illustrations); };
  const call = useCallback(async (method: "GET" | "PUT", body?: unknown) => {
    const r = await fetch("/api/admin/brand", { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error ?? `Something went wrong (${r.status}).`);
    return b as Overview;
  }, []);

  useEffect(() => {
    if (!isJira) return;
    call("GET").then(apply).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }, [call]);

  if (!isJira) return <main className="page [&>*:not(.fixed)]:max-w-3xl"><p className="text-sm text-muted">The brand library folders can be set once sign-in is turned on.</p></main>;

  const save = async () => {
    setBusy(true); setError(null); setNote(null);
    try { apply(await call("PUT", { photos, illustrations })); setNote("Saved. Photos and Illustrations now read from these folders."); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); }
    setBusy(false);
  };
  const g = data?.google;
  const input = "mt-2 block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal";

  return (
    <main className="page [&>*:not(.fixed)]:max-w-3xl">
      <PageTitle>Brand library</PageTitle>
      <p className="mb-6 text-sm text-muted">Photos and illustrations live in shared Google Drive folders. Paste each folder&apos;s link and the Hub shows them in the Brand Assets area. Your Google account is what reads the folders, so use an account that will stay with the team.</p>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
      {note && <div className="mb-4"><Callout tone="ok" icon="check">{note}</Callout></div>}

      <section className="card mb-4 p-6" aria-labelledby="gdrive">
        <h2 id="gdrive" className="text-lg font-bold">Google Drive access</h2>
        {g && !g.configured && <p className="mt-2 text-sm text-muted">Google isn&apos;t set up for this app yet. See docs/google-setup.md.</p>}
        {g?.configured && !g.canReadDrive && (
          <>
            <p className="mb-4 mt-2 text-sm text-muted">Connect your Google account and allow access to Drive files. It&apos;s read-only.</p>
            <a href="/api/google/connect" className="btn btn-md btn-secondary">Connect Google</a>
          </>
        )}
        {g?.canReadDrive && <div className="mt-4"><Tag tone="ok" icon="check">Drive access on</Tag></div>}
      </section>

      <section className="card p-6" aria-labelledby="folders">
        <h2 id="folders" className="text-lg font-bold">Folders</h2>
        <label className="mt-4 block text-sm font-bold">Photos folder
          <input value={photos} onChange={(e) => setPhotos(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={input} />
        </label>
        <label className="mt-4 block text-sm font-bold">Illustrations folder
          <input value={illustrations} onChange={(e) => setIllustrations(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={input} />
          <span className="mt-2 block text-xs font-normal text-muted">Subfolders show up as categories. Leave a field empty to hide that library.</span>
        </label>
        <div className="mt-4 flex items-center gap-4">
          <button onClick={save} disabled={busy || !g?.canReadDrive} className="btn btn-md btn-primary">{busy ? "Saving…" : "Save"}</button>
          {data?.config.owner && <span className="text-xs text-muted">Read with {data.config.owner}&apos;s Google account</span>}
        </div>
      </section>
    </main>
  );
}
