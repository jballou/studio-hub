"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StageTag } from "@/components/ui/Tag";
import { mockControls, projectsRepo, repo } from "@/lib/data";
import type { Anchor, Asset, AssetVersion, Stage, Thread, User } from "@/lib/types";
import { AnnotationLayer, type Pin } from "./AnnotationLayer";
import { CommentList, Composer, type Draft, type Tab } from "./CommentPanel";
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
  const [stage, setStage] = useState<Stage>("In feedback");
  const [commenting, setCommenting] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
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
  const [menuOpen, setMenuOpen] = useState(false);
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
      const project = (await projectsRepo.listProjects("u-avery")).find((p) => p.jiraKey === a.projectKey);
      if (project) setStage(project.stage);
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

  const capture = useCallback((): number | null => {
    if (kind !== "video") return null;
    video.current?.pause();
    return video.current?.currentMs() ?? 0;
  }, [kind]);

  const startComment = useCallback(() => {
    setDraft((d) => d ?? { hasPin: false, capturedMs: capture() });
  }, [capture]);

  const onDraftAnchor = useCallback((a: Anchor) => {
    setAnchor(a);
    setSelectedId(null);
    setDraft((d) => (d ? { ...d, hasPin: true } : { hasPin: true, capturedMs: capture() }));
  }, [capture]);

  if (!asset || !version || !me) {
    return <div className="p-8 text-sm text-muted">{asset === null ? "Loading…" : ""}</div>;
  }

  const canResolve = (t: Thread) => me.role === "creative" || t.authorId === me.id;
  const canPush = (t: Thread) => me.role === "creative" || t.authorId === me.id;
  const closed = stage === "Delivered";

  const markSeen = (id: string) => setSeen((s) => new Set(s).add(id));

  const select = (t: Thread) => {
    setSelectedId(t.id);
    markSeen(t.id);
    resetDraft();
    if (kind === "pdf" && t.page) setPage(t.page);
    if (kind === "video" && t.timeMs != null) video.current?.seek(t.timeMs);
  };
  const selectById = (id: string) => { const t = threads.find((x) => x.id === id); if (t) select(t); };

  const unreadIds = new Set(threads.filter((t) => t.authorId !== me.id && !seen.has(t.id)).map((t) => t.id));
  const firstUnread = threads.find((t) => unreadIds.has(t.id));

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
    markSeen(t.id);
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

  const pins: Pin[] = showPins
    ? visibleOnCanvas.map((t) => ({
        id: t.id, number: t.number, anchor: t.anchor!, resolved: t.status === "resolved", editable: canResolve(t),
      }))
    : [];

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
      enabled={commenting && showPins}
      pins={pins}
      selectedId={selectedId}
      draft={showPins ? anchor : null}
      onSelect={selectById}
      onDraftChange={onDraftAnchor}
      onEditAnchor={async (id, a) => replace(await repo.updateAnchor(id, a))}
    />
  );

  const src = localSrc ?? version.src;
  const btn = "rounded-full border border-control px-4 py-1.5 text-sm font-medium hover:bg-brand-soft disabled:opacity-40";

  return (
    <div className="paper flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-5 py-2.5 text-sm">
        <Link href="/projects" className="font-medium text-brand hover:underline">Projects</Link>
        <Link href="/review" className="font-medium text-brand hover:underline">Designs</Link>
        <span className="h-5 w-px bg-line" />
        <h1 className="truncate font-semibold">{asset.projectKey} · {asset.name}</h1>
        <StageTag stage={stage} />
        <span className="h-5 w-px bg-line" />
        <button className={btn} disabled={closed} onClick={() => setStage("In progress")}>Ask for changes</button>
        <button
          disabled={closed}
          onClick={() => setStage("Delivered")}
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-n-50 hover:bg-brand-dark disabled:opacity-60"
        >
          <Icon name="delivered" size={16} /> {closed ? "Approved" : "Mark as approved"}
        </button>

        <div className="relative ml-auto">
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="More options" aria-expanded={menuOpen} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-brand-soft">
            <Icon name="more" size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-72 space-y-3 rounded-xl border border-line bg-white p-3 text-xs shadow-lg">
              <p className="font-semibold uppercase tracking-wide text-muted">Demo controls (mock data)</p>
              <label className="flex items-center justify-between gap-2">Viewing as
                <select value={me.id} onChange={(e) => { setMeId(e.target.value); setSelectedId(null); }} className="rounded border border-control px-1 py-1">
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={simFail} onChange={(e) => { setSimFail(e.target.checked); mockControls.simulatePushFailure = e.target.checked; }} />
                Make the next Jira push fail
              </label>
              {kind === "video" && (
                <label className="block cursor-pointer rounded border border-control px-2 py-1.5 text-center hover:bg-brand-soft">
                  Load a local video file
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setLocalSrc(URL.createObjectURL(f));
                  }} />
                </label>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-2">
        <label className="relative">
          <span className="sr-only">Version</span>
          <select
            value={version.id}
            onChange={(e) => { setVersionId(e.target.value); setSelectedId(null); resetDraft(); setLocalSrc(null); }}
            className="appearance-none rounded-full border border-control bg-white py-1.5 pl-4 pr-9 text-sm"
          >
            {versions.map((v) => <option key={v.id} value={v.id}>Version {v.number}</option>)}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"><Icon name="chevronDown" size={14} /></span>
        </label>
        <button
          onClick={() => setCommenting((c) => !c)}
          aria-pressed={commenting}
          title={commenting ? "Commenting is on. Click the design to add a pin" : "Turn commenting on"}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${commenting ? "bg-brand-soft text-ink" : "border border-control"}`}
        >
          <Icon name="comment" size={16} /> Comment
        </button>

        <div className="ml-auto flex items-center gap-2">
          {firstUnread && (
            <button onClick={() => select(firstUnread)} className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-medium text-n-50 hover:bg-brand-dark">
              {unreadIds.size} unread <Icon name="chevronRight" size={12} />
            </button>
          )}
          <button
            onClick={() => setShowPins((s) => !s)}
            aria-pressed={!showPins}
            aria-label={showPins ? "Hide pins" : "Show pins"}
            title={showPins ? "Hide pins on the design" : "Show pins on the design"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-n-150 hover:bg-n-200"
          >
            <Icon name={showPins ? "eye" : "eyeOff"} size={16} />
          </button>
          <Link href="/projects" aria-label="Close review" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-n-150">
            <Icon name="x" size={16} />
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          {kind === "image" && <ImageViewer src={src} aspect={version.aspect} overlay={overlay} />}
          {kind === "pdf" && (
            <>
              <PdfViewer src={src} page={page} onPageCount={setPageCount} overlay={overlay} />
              <div className="flex items-center justify-center gap-3 pb-1 text-sm">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="rounded-full border border-control px-3 py-0.5 disabled:opacity-40">‹</button>
                <span>Page {page} of {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="rounded-full border border-control px-3 py-0.5 disabled:opacity-40">›</button>
              </div>
            </>
          )}
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
          <div className="px-5 pb-5 pt-3">
            <Composer
              users={users}
              me={me}
              isVideo={kind === "video"}
              draft={draft}
              hasPdfPage={kind === "pdf" ? page : null}
              onStart={startComment}
              onClearPin={resetDraft}
              onSubmit={submit}
            />
          </div>
        </section>

        <CommentList
          threads={listed}
          counts={counts}
          users={users}
          me={me}
          selectedId={selectedId}
          unreadIds={unreadIds}
          tab={tab}
          mine={mine}
          unpushed={unpushed}
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
        />
      </div>
    </div>
  );
}
