"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { mockControls, repo } from "@/lib/data";
import type { Anchor, Asset, AssetVersion, Thread, User } from "@/lib/types";
import { AnnotationLayer, type Pin, type Tool } from "./AnnotationLayer";
import { CommentPanel, type Draft, type Tab } from "./CommentPanel";
import { ImageViewer } from "./ImageViewer";
import { PdfViewer } from "./PdfViewer";
import { VideoViewer, type Marker, type VideoHandle } from "./VideoViewer";

/** Annotations on video show only within this window of their timestamp (or while selected). */
const VISIBLE_WINDOW_MS = 500;

export function ReviewWorkspace({ assetId }: { assetId: string }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState("u-avery");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [tool, setTool] = useState<Tool>("pointer");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [mine, setMine] = useState(false);
  const [unpushed, setUnpushed] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [simFail, setSimFail] = useState(false);
  const video = useRef<VideoHandle>(null);

  useEffect(() => {
    (async () => {
      const a = await repo.getAsset(assetId);
      if (!a) return;
      const vs = (await Promise.all(a.versionIds.map((id) => repo.getVersion(id)))).filter((v): v is AssetVersion => !!v);
      setAsset(a);
      setVersions(vs);
      setVersionId(vs[vs.length - 1]?.id ?? null);
      setUsers(await repo.listUsers());
    })();
  }, [assetId]);

  useEffect(() => {
    if (!versionId) return;
    let live = true;
    repo.listThreads(versionId).then((t) => { if (live) setThreads(t); });
    return () => { live = false; };
  }, [versionId]);

  const me = users.find((u) => u.id === meId);
  const version = versions.find((v) => v.id === versionId);
  const kind = asset?.kind;

  const resetDraft = useCallback(() => { setAnchor(null); setDraft(null); }, []);

  const replace = (t: Thread) => setThreads((ts) => ts.map((x) => (x.id === t.id ? t : x)));

  // Tool shortcuts: V pointer, D dot, B box (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      if (e.key === "v") setTool("pointer");
      if (e.key === "d") setTool("dot");
      if (e.key === "b") setTool("box");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startComment = useCallback(() => {
    setDraft((d) => {
      if (d) return d;
      let capturedMs: number | null = null;
      if (kind === "video") {
        video.current?.pause();
        capturedMs = video.current?.currentMs() ?? 0;
      }
      return { hasPin: false, capturedMs };
    });
  }, [kind]);

  const onDraftAnchor = useCallback((a: Anchor) => {
    setAnchor(a);
    setSelectedId(null);
    setDraft((d) => {
      if (d) return { ...d, hasPin: true };
      let capturedMs: number | null = null;
      if (kind === "video") {
        video.current?.pause();
        capturedMs = video.current?.currentMs() ?? 0;
      }
      return { hasPin: true, capturedMs };
    });
  }, [kind]);

  if (!asset || !version || !me) {
    return <div className="p-8 text-sm text-muted">{asset === null ? "Loading…" : ""}</div>;
  }

  const canComment = true; // mock: every user is invited; real adapter enforces invitations
  const canResolve = (t: Thread) => me.role === "creative" || t.authorId === me.id;
  const canPush = (t: Thread) => me.role === "creative" || t.authorId === me.id;

  const select = (t: Thread) => {
    setSelectedId(t.id);
    resetDraft();
    if (kind === "pdf" && t.page) setPage(t.page);
    if (kind === "video" && t.timeMs != null) video.current?.seek(t.timeMs);
  };
  const selectById = (id: string) => { const t = threads.find((x) => x.id === id); if (t) select(t); };

  const submit = async (body: string, withTime: boolean) => {
    const t = await repo.createThread({
      versionId: version.id,
      authorId: me.id,
      body,
      anchor,
      timeMs: kind === "video" && withTime ? draft?.capturedMs ?? video.current?.currentMs() ?? 0 : null,
      page: kind === "pdf" ? page : null,
    });
    setThreads((ts) => [...ts, t]);
    resetDraft();
    setSelectedId(t.id);
  };

  const push = async (id: string) => replace(await repo.pushToJira(id, me.id));
  const pushAll = async () => {
    for (const t of threads) if (!t.jira && canPush(t)) await push(t.id);
  };

  const visibleOnCanvas = threads.filter((t) => {
    if (!t.anchor) return false;
    if (t.id === selectedId) return true;
    if (t.status !== "open") return false;
    if (kind === "pdf") return t.page === page;
    if (kind === "video") return t.timeMs == null || Math.abs(t.timeMs - timeMs) <= VISIBLE_WINDOW_MS;
    return true;
  });

  const pins: Pin[] = visibleOnCanvas.map((t) => ({
    id: t.id, number: t.number, anchor: t.anchor!, resolved: t.status === "resolved",
    editable: canResolve(t),
  }));

  const markers: Marker[] = threads
    .filter((t) => t.timeMs != null)
    .map((t) => ({
      id: t.id, timeMs: t.timeMs!, number: t.number, resolved: t.status === "resolved",
      initials: users.find((u) => u.id === t.authorId)?.initials ?? "?",
    }));

  const counts: Record<Tab, number> = {
    all: threads.length,
    open: threads.filter((t) => t.status === "open").length,
    resolved: threads.filter((t) => t.status === "resolved").length,
  };
  const listed = threads.filter((t) =>
    (tab === "all" || t.status === tab) && (!mine || t.authorId === me.id) && (!unpushed || !t.jira));

  const overlay = (
    <AnnotationLayer
      tool={tool}
      pins={pins}
      selectedId={selectedId}
      draft={anchor}
      onSelect={selectById}
      onDraftChange={onDraftAnchor}
      onEditAnchor={async (id, a) => replace(await repo.updateAnchor(id, a))}
    />
  );

  const src = localSrc ?? version.src;

  const toolBtn = (t: Tool, label: string, key: string) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      className={`rounded px-3 py-1 text-sm ${tool === t ? "bg-brand text-white" : "border border-line hover:bg-brand-soft"}`}
    >
      {label} <kbd className="ml-1 text-[10px] opacity-60">{key}</kbd>
    </button>
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2 text-sm">
        <Link href="/review" className="text-muted hover:underline">← Assets</Link>
        <span className="font-semibold">{asset.name}</span>
        <span className="rounded bg-line px-1.5 py-0.5 font-mono text-xs">{asset.projectKey}</span>
        <select value={version.id} onChange={(e) => { setVersionId(e.target.value); setSelectedId(null); resetDraft(); setLocalSrc(null); }} className="rounded border border-line px-2 py-1">
          {versions.map((v) => <option key={v.id} value={v.id}>Version {v.number}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {kind === "video" && (
            <label className="cursor-pointer rounded border border-line px-2 py-1 hover:bg-brand-soft">
              Load local video
              <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setLocalSrc(URL.createObjectURL(f));
              }} />
            </label>
          )}
          <label className="flex items-center gap-1" title="Mock only: makes the next Jira push fail">
            <input type="checkbox" checked={simFail} onChange={(e) => { setSimFail(e.target.checked); mockControls.simulatePushFailure = e.target.checked; }} />
            Simulate push failure
          </label>
          <label className="flex items-center gap-1">
            Viewing as
            <select value={me.id} onChange={(e) => { setMeId(e.target.value); setSelectedId(null); }} className="rounded border border-line px-1 py-1">
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col bg-stone-200">
          <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-2">
            {toolBtn("pointer", "Pointer", "V")}
            {toolBtn("dot", "Dot", "D")}
            {toolBtn("box", "Box", "B")}
            {kind === "pdf" && (
              <div className="ml-auto flex items-center gap-2 text-sm">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">‹</button>
                <span>Page {page} / {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">›</button>
              </div>
            )}
          </div>

          {kind === "image" && <ImageViewer src={src} aspect={version.aspect} overlay={overlay} />}
          {kind === "pdf" && <PdfViewer src={src} page={page} onPageCount={setPageCount} overlay={overlay} />}
          {kind === "video" && (
            <VideoViewer
              src={src}
              aspect={version.aspect}
              overlay={overlay}
              markers={markers}
              selectedId={selectedId}
              onMarkerClick={selectById}
              onTime={setTimeMs}
              handleRef={video}
            />
          )}
        </section>

        <CommentPanel
          threads={listed}
          allCount={counts}
          users={users}
          me={me}
          selectedId={selectedId}
          tab={tab}
          mine={mine}
          unpushed={unpushed}
          isVideo={kind === "video"}
          draft={draft}
          canComment={canComment}
          canResolve={canResolve}
          canPush={canPush}
          onTab={setTab}
          onMine={setMine}
          onUnpushed={setUnpushed}
          onSelect={select}
          onReply={async (id, body) => replace(await repo.reply(id, me.id, body))}
          onStatus={async (id, s) => replace(await repo.setStatus(id, s))}
          onPush={push}
          onPushAll={pushAll}
          onStartComposer={startComment}
          onClearPin={resetDraft}
          onSubmit={submit}
        />
      </div>
    </div>
  );
}
