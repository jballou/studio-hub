"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu } from "@/components/ui/Menu";
import { useMe } from "@/hooks/useMe";
import { Icon } from "@/components/ui/Icon";
import { StageTag } from "@/components/ui/Tag";
import { formatDue } from "@/lib/time";
import { isJira, mockControls, projectsRepo, repo } from "@/lib/data";
import type { Anchor, Asset, AssetVersion, Person, Severity, Stage, Thread, User } from "@/lib/types";
import { AnnotationLayer, type Pin } from "./AnnotationLayer";
import { CommentList, Composer, type Draft, type Tab } from "./CommentPanel";
import { EmbedViewer } from "./EmbedViewer";
import { ImageViewer } from "./ImageViewer";
import { PdfViewer } from "./PdfViewer";
import type { Zoom } from "./Stage";
import { ZoomControl } from "./ZoomControl";
import { celebrate } from "@/lib/celebrate";
import { copyText, reviewLink, ShareDialog } from "./ShareDialog";
import { BatchStepper } from "./BatchStepper";
import { VideoViewer, type Marker, type VideoHandle } from "./VideoViewer";

const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const toUser = (p: Person): User => ({ id: p.id, name: p.name, initials: initialsOf(p.name), role: "requester" });
const addUsers = (list: User[], more: User[]) => [...list, ...more.filter((m) => !list.some((u) => u.id === m.id))];

/** Annotations on video show only within this window of their timestamp (or while selected). */
const VISIBLE_WINDOW_MS = 500;

export function ReviewWorkspace({ assetId }: { assetId: string }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [siblings, setSiblings] = useState<Asset[]>([]);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState("u-avery");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [stage, setStage] = useState<Stage>("In feedback");
  const [commenting, setCommenting] = useState(true);
  const [zoom, setZoom] = useState<Zoom>("fit");
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
  const router = useRouter();
  const [trashAsk, setTrashAsk] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const video = useRef<VideoHandle>(null);

  useEffect(() => {
    (async () => {
      const a = await repo.getAsset(assetId);
      if (!a) return;
      const vs = (await Promise.all(a.versionIds.map((id) => repo.getVersion(id)))).filter((v): v is AssetVersion => !!v);
      setAsset(a);
      // Other items sent in the same batch, in the order they were added.
      if (a.batch) repo.listAssets().then((all) => setSiblings(all.filter((x) => x.batch?.id === a.batch!.id).sort((x, y) => x.batch!.index - y.batch!.index)));
      else setSiblings([]);
      setVersions(vs);
      setVersionId(vs[vs.length - 1]?.id ?? null);
      // Demo users in mock mode; in real mode, just the people named on this request (plus you, below).
      const loaded = addUsers(await repo.listUsers(), [...(a.reviewers ?? []), ...(a.approvers ?? [])].map(toUser));
      // Merge, don't replace: "you" may have arrived from /api/me while this was loading.
      setUsers((cur) => addUsers(cur, loaded));
      const project = await projectsRepo.getProject(a.projectKey, "u-avery");
      if (a.review === "approved") setStage("Delivered");
      else if (a.review === "changes") setStage("In progress");
      else if (project) setStage(project.stage);
    })();
  }, [assetId]);

  useEffect(() => {
    if (!versionId) return;
    let live = true;
    repo.listThreads(versionId).then((t) => {
      if (!live) return;
      setThreads(t);
      // Real mode has no people list: learn who wrote what from the comments themselves.
      const authors: User[] = t.flatMap((x) => x.comments).filter((c) => c.authorName).map((c) => ({ id: c.authorId, name: c.authorName!, initials: initialsOf(c.authorName!), role: c.authorRole ?? "requester" }));
      if (authors.length) setUsers((list) => addUsers(list, authors));
    });
    return () => { live = false; };
  }, [versionId]);

  // In real mode you are whoever is signed in, not a demo persona. Shares the one "who am I" request with the rest of the page.
  const who = useMe();
  const meUser = useMemo<User | undefined>(() => (who ? { id: who.id, name: who.name, initials: initialsOf(who.name), role: who.role } : undefined), [who]);

  const me = isJira ? meUser : users.find((u) => u.id === meId);
  const version = versions.find((v) => v.id === versionId);
  const kind = asset?.kind;
  const timed = kind === "video" || kind === "audio";
  const [manualTime, setManualTime] = useState(false);

  const resetDraft = useCallback(() => { setAnchor(null); setDraft(null); }, []);
  const replace = (t: Thread) => setThreads((ts) => ts.map((x) => (x.id === t.id ? t : x)));

  const capture = useCallback((): number | null => {
    if (!timed) return null;
    video.current?.pause();
    return video.current?.currentMs() ?? 0;
  }, [timed]);

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

  // Everyone who can appear on screen: the loaded people, you, and anyone whose name is saved on a comment.
  const people = addUsers(
    addUsers(users, me ? [me] : []),
    threads.flatMap((t) => t.comments).filter((c) => c.authorName).map((c) => ({ id: c.authorId, name: c.authorName!, initials: initialsOf(c.authorName!), role: c.authorRole ?? "requester" } as User)),
  );

  const canResolve = (t: Thread) => me.role === "creative" || t.authorId === me.id;
  const canPush = (t: Thread) => me.role === "creative" || t.authorId === me.id;
  const closed = stage === "Delivered";
  // Only people named as approvers on the feedback request see the approve button.
  const canApprove = !!asset.approvers?.some((p) => p.id === me.id);
  const canShare = me.role === "creative" || asset.submittedBy === me.id || canApprove;

  const markSeen = (id: string) => setSeen((s) => new Set(s).add(id));

  const select = (t: Thread) => {
    setSelectedId(t.id);
    markSeen(t.id);
    resetDraft();
    if (kind === "pdf" && t.page) setPage(t.page);
    if (timed && t.timeMs != null) video.current?.seek(t.timeMs);
  };
  const selectById = (id: string) => { const t = threads.find((x) => x.id === id); if (t) select(t); };

  const unreadIds = new Set(threads.filter((t) => t.authorId !== me.id && !seen.has(t.id)).map((t) => t.id));
  const firstUnread = threads.find((t) => unreadIds.has(t.id));

  const submit = async (body: string, withTime: boolean, typedMs?: number | null, severity?: Severity) => {
    const t = await repo.createThread({
      versionId: version.id,
      authorId: me.id,
      body,
      severity,
      anchor,
      timeMs: timed && withTime ? (manualTime ? typedMs ?? 0 : draft?.capturedMs ?? video.current?.currentMs() ?? 0) : null,
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
      initials: people.find((u) => u.id === t.authorId)?.initials ?? "?",
      name: people.find((u) => u.id === t.authorId)?.name ?? "Someone",
      creative: people.find((u) => u.id === t.authorId)?.role === "creative",
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
  const btn = "btn btn-sm btn-secondary";

  return (
    <div className="paper flex h-[calc(100vh-16px)] flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-6 py-2 text-sm">
        <Link href="/review" aria-label="Back to Review" title="Back to Review" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-round hover:bg-n-150">
          <span className="rotate-180"><Icon name="chevronRight" size={18} /></span>
        </Link>
        <h1 className="min-w-0 truncate font-bold">
          <Link href={`/projects/${asset.projectKey}`} className="font-mono text-brand hover:underline" title="Open project">{asset.projectKey}</Link> · {asset.name}
        </h1>
        <StageTag stage={stage} />
        {asset.batch && siblings.length > 1 && <BatchStepper current={asset} items={siblings} />}

        <div className="ml-auto flex items-center gap-2">
          {closed ? (
            canShare && <button className={btn} onClick={() => { setStage("In feedback"); void repo.setReviewState(asset.id, "awaiting"); }}>Reopen</button>
          ) : (
            <>
              <button className={btn} onClick={() => { setStage("In progress"); void repo.setReviewState(asset.id, "changes"); }}>Ask for changes</button>
              {canApprove && (
                <button
                  onClick={() => { setStage("Delivered"); void repo.setReviewState(asset.id, "approved"); celebrate(); }}
                  className="btn btn-md btn-primary"
                >
                  <Icon name="delivered" size={16} /> Approve
                </button>
              )}
            </>
          )}
          <span className="mx-2 h-5 w-px bg-line" aria-hidden="true" />
          <button onClick={() => setShareOpen(true)} title={asset.linkAccess ? "Anyone at SurveyMonkey with the link can open this" : "Only people you add can open this"} className="btn btn-sm btn-ghost">
            <Icon name={asset.linkAccess ? "users" : "lock"} size={16} /> Share
          </button>
          <button
            onClick={async () => { setCopied(await copyText(reviewLink(asset))); setTimeout(() => setCopied(false), 1500); }}
            aria-label={copied ? "Link copied" : "Copy link"} title={copied ? "Link copied" : "Copy link"}
            className="flex h-8 w-8 items-center justify-center rounded-round hover:bg-n-150"
          >
            <Icon name={copied ? "check" : "link"} size={18} />
          </button>
          <Menu
            items={[
              ...(canShare ? [{ label: "Upload a new version", icon: "upload" as const, onSelect: () => router.push(`/submit?version=${asset.id}`) }] : []),
              ...(canShare ? [{ kind: "divider" as const }, { label: "Move to Trash", icon: "trash" as const, danger: true, onSelect: () => setTrashAsk(true) }] : []),
              ...(!isJira ? [
                { kind: "divider" as const },
                { kind: "custom" as const, node: <p className="eyebrow text-muted">Demo controls</p> },
                { kind: "custom" as const, node: (
                  <label className="flex items-center justify-between gap-2 text-xs">Viewing as
                    <select value={me.id} onChange={(e) => { setMeId(e.target.value); setSelectedId(null); }} className="rounded-tight border border-control px-2 py-2">
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                  </label>
                ) },
                { kind: "custom" as const, node: (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={simFail} onChange={(e) => { setSimFail(e.target.checked); mockControls.simulatePushFailure = e.target.checked; }} />
                    Make the next Jira push fail
                  </label>
                ) },
                ...(kind === "video" ? [{ kind: "custom" as const, node: (
                  <label className="block cursor-pointer rounded-tight border border-control px-2 py-2 text-center text-xs hover:bg-n-150">
                    Load a local video file
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setLocalSrc(URL.createObjectURL(f)); }} />
                  </label>
                ) }] : []),
              ] : []),
            ]}
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 border-b border-line bg-white px-6 py-2">
        <label className="relative">
          <span className="sr-only">Version</span>
          <select
            value={version.id}
            onChange={(e) => { setVersionId(e.target.value); setSelectedId(null); resetDraft(); setLocalSrc(null); setZoom("fit"); }}
            className="appearance-none rounded-round border border-control bg-white py-2 pl-4 pr-10 text-sm"
          >
            {versions.map((v) => <option key={v.id} value={v.id}>Version {v.number}</option>)}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"><Icon name="chevronDown" size={14} /></span>
        </label>
        {canShare && (
          <Link href={`/submit?version=${asset.id}`} className="btn btn-sm btn-ghost text-brand" title="Upload a new version of this design for re-review">
            <Icon name="upload" size={14} /> New version
          </Link>
        )}
        <span className="h-5 w-px bg-line" aria-hidden="true" />
        <div role="group" aria-label="What clicking the design does" className="seg">
          <button onClick={() => setCommenting(false)} aria-pressed={!commenting} title="Scroll and click inside the design" className="seg-item">Browse</button>
          <button onClick={() => setCommenting(true)} aria-pressed={commenting} title="Click the design to add a pin" className="seg-item"><Icon name="comment" size={16} /> Comment</button>
        </div>
        {kind !== "audio" && <ZoomControl zoom={zoom} onChange={setZoom} />}
        <button
          onClick={() => setShowPins((p) => !p)}
          aria-pressed={showPins}
          title={showPins ? "Hide pins on the design" : "Show pins on the design"}
          className={`btn btn-sm btn-ghost ${showPins ? "" : "bg-n-150"}`}
        >
          <Icon name={showPins ? "eye" : "eyeOff"} size={16} /> {showPins ? "Pins" : "Pins hidden"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          {kind === "image" && <ImageViewer src={src} aspect={version.aspect} zoom={zoom} overlay={overlay} />}
          {kind === "embed" && version.embedUrl && (
            <EmbedViewer
              embedUrl={version.embedUrl}
              openUrl={asset.source?.url ?? version.embedUrl}
              aspect={version.aspect}
              baseWidth={version.baseWidth ?? 1280}
              zoom={zoom}
              commenting={commenting && showPins}
              overlay={overlay}
            />
          )}
          {kind === "pdf" && (
            <>
              <PdfViewer src={src} page={page} zoom={zoom} onPageCount={setPageCount} overlay={overlay} />
              <div className="flex items-center justify-center gap-4 pb-2 text-sm">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="btn btn-icon btn-secondary">‹</button>
                <span>Page {page} of {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="btn btn-icon btn-secondary">›</button>
              </div>
            </>
          )}
          {timed && (
            <VideoViewer
              key={src}
              audio={kind === "audio"}
              fallbackEmbed={version.embedUrl}
              fallbackHost={asset.source?.kind === "wistia" ? "Wistia" : "Drive"}
              onFallback={setManualTime}
              zoom={zoom}
              src={src}
              aspect={version.aspect}
              overlay={kind === "audio" ? null : overlay}
              markers={markers}
              selectedId={selectedId}
              onMarkerClick={selectById}
              onTime={setTimeMs}
              handleRef={video}
            />
          )}
          <div className="px-4 pb-4 pt-2">
            <Composer
              me={me}
              isVideo={timed}
              audio={kind === "audio"}
              manualTime={manualTime}
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
          users={people}
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
          onEdit={async (id, cid, body, sev) => replace(await repo.editComment(id, cid, body, sev))}
          onStatus={async (id, s) => replace(await repo.setStatus(id, s))}
          onPush={push}
          onPushAll={pushAll}
          onJumpUnread={firstUnread ? () => select(firstUnread) : undefined}
          request={asset.instructions || asset.dueAt ? { from: people.find((u) => u.id === asset.submittedBy)?.name ?? "A teammate", due: asset.dueAt ? formatDue(asset.dueAt, asset.dueTz) : undefined, instructions: asset.instructions, approvers: (asset.approvers ?? []).map((p) => p.name) } : null}
        />
      </div>
      {trashAsk && (
        <ConfirmDialog
          title="Move to Trash?" confirmLabel="Move to Trash" danger busy={trashing}
          body={`“${asset.name}” and its comments will be hidden for everyone. The creative team can restore it from Trash for 30 days, then it is removed for good.`}
          onCancel={() => setTrashAsk(false)}
          onConfirm={async () => { setTrashing(true); try { await repo.deleteAsset(asset.id); router.push("/review"); } catch { setTrashing(false); setTrashAsk(false); } }}
        />
      )}
      {shareOpen && <ShareDialog asset={asset} users={people} canManage={canShare} onClose={() => setShareOpen(false)} onChange={setAsset} />}
    </div>
  );
}
