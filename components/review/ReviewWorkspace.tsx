"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { StageTag } from "@/components/ui/Tag";
import { formatDue } from "@/lib/time";
import { isJira, mockControls, projectsRepo, repo } from "@/lib/data";
import type { Anchor, Asset, AssetVersion, Person, Stage, Thread, User } from "@/lib/types";
import { AnnotationLayer, type Pin } from "./AnnotationLayer";
import { CommentList, Composer, type Draft, type Tab } from "./CommentPanel";
import { EmbedViewer } from "./EmbedViewer";
import { ImageViewer } from "./ImageViewer";
import { PdfViewer } from "./PdfViewer";
import type { Zoom } from "./Stage";
import { ZoomControl } from "./ZoomControl";
import { celebrate } from "@/lib/celebrate";
import { copyText, reviewLink, ShareDialog } from "./ShareDialog";
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
  const [meUser, setMeUser] = useState<User>();
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
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const [trashAsk, setTrashAsk] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMenu, setShareMenu] = useState(false);
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

  // In real mode you are whoever is signed in, not a demo persona.
  useEffect(() => {
    if (!isJira) return;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!m) return;
        const u: User = { id: m.accountId, name: m.name, initials: initialsOf(m.name), role: m.role };
        setMeUser(u);
        setUsers((list) => addUsers(list, [u]));
      });
  }, []);

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

  const submit = async (body: string, withTime: boolean, typedMs?: number | null) => {
    const t = await repo.createThread({
      versionId: version.id,
      authorId: me.id,
      body,
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
  const btn = "rounded-full border border-control px-4 py-1.5 text-sm font-medium hover:bg-brand-soft disabled:opacity-40";

  return (
    <div className="paper flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-5 py-2.5 text-sm">
        <h1 className="truncate font-semibold"><Link href={`/projects/${asset.projectKey}`} className="font-mono text-brand hover:underline" title="Open project">{asset.projectKey}</Link> · {asset.name}</h1>
        <StageTag stage={stage} />
        <span className="h-5 w-px bg-line" />
        <button className={btn} disabled={closed} onClick={() => { setStage("In progress"); void repo.setReviewState(asset.id, "changes"); }}>Ask for changes</button>
        {canApprove && (
          <button
            disabled={closed}
            onClick={() => { setStage("Delivered"); void repo.setReviewState(asset.id, "approved"); celebrate(); }}
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-n-50 hover:bg-brand-dark disabled:opacity-60"
          >
            <Icon name="delivered" size={16} /> {closed ? "Approved" : "Mark as approved"}
          </button>
        )}

        <div className="relative ml-auto flex items-center">
          <div className="flex items-stretch rounded-full bg-brand-soft text-ink">
            <button onClick={() => setShareOpen(true)} className="flex items-center gap-2 rounded-l-full py-1.5 pl-4 pr-3 text-sm font-medium hover:bg-brand-fill/20">
              <Icon name="users" size={16} /> Share
            </button>
            <span className="my-1.5 w-px bg-brand-fill/40" />
            <button onClick={() => setShareMenu((o) => !o)} aria-label="Quick share options" aria-expanded={shareMenu} className="flex items-center rounded-r-full pl-2 pr-3 hover:bg-brand-fill/20">
              <Icon name="chevronDown" size={14} />
            </button>
          </div>
          {shareMenu && (
            <div className="absolute right-12 top-full z-30 mt-1 w-64 rounded-xl border border-line bg-white p-1 text-sm shadow-lg">
              <button
                onClick={async () => { setCopied(await copyText(reviewLink(asset))); setTimeout(() => { setCopied(false); setShareMenu(false); }, 1200); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-medium hover:bg-n-150"
              >
                <Icon name={copied ? "check" : "link"} size={16} /> {copied ? "Link copied" : "Copy link"}
              </button>
              <p className="px-3 pb-2 pt-1 text-xs text-muted">{asset.linkAccess ? "Anyone at SurveyMonkey with the link can open it." : "Only people with access can open it. Use Share to add people."}</p>
            </div>
          )}
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="More options" aria-expanded={menuOpen} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-brand-soft">
            <Icon name="more" size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-72 space-y-3 rounded-xl border border-line bg-white p-3 text-xs shadow-lg">
              {canShare && (
                <button onClick={() => { setMenuOpen(false); setTrashAsk(true); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-bad-fg hover:bg-bad-bg">
                  <Icon name="trash" size={16} /> Move to Trash
                </button>
              )}
              {!isJira && <p className="font-semibold uppercase tracking-wide text-muted">Demo controls (mock data)</p>}
              {!isJira && (
                <label className="flex items-center justify-between gap-2">Viewing as
                  <select value={me.id} onChange={(e) => { setMeId(e.target.value); setSelectedId(null); }} className="rounded border border-control px-1 py-1">
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </label>
              )}
              {!isJira && <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={simFail} onChange={(e) => { setSimFail(e.target.checked); mockControls.simulatePushFailure = e.target.checked; }} />
                Make the next Jira push fail
              </label>}
              {!isJira && kind === "video" && (
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

      {asset.batch && siblings.length > 1 && (() => {
        const i = siblings.findIndex((s) => s.id === asset.id);
        const prev = siblings[i - 1], next = siblings[i + 1];
        const link = "rounded-full border border-control px-3 py-1 text-sm font-medium hover:bg-brand-soft";
        return (
          <nav aria-label="Items in this batch" className="flex items-center gap-3 border-b border-line bg-n-100 px-5 py-2 text-sm">
            <span className="font-semibold">{asset.batch.title}</span>
            <span className="text-muted">Item {i + 1} of {siblings.length}</span>
            <ol className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {siblings.map((s, n) => (
                <li key={s.id}>
                  <Link href={`/review/${s.id}`} title={s.name} aria-current={s.id === asset.id ? "page" : undefined} className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${s.id === asset.id ? "bg-brand text-n-50" : "border border-control bg-white hover:bg-brand-soft"}`}>{n + 1}</Link>
                </li>
              ))}
            </ol>
            {prev ? <Link href={`/review/${prev.id}`} className={link}>‹ Previous</Link> : <span className={`${link} opacity-40`}>‹ Previous</span>}
            {next ? <Link href={`/review/${next.id}`} className={link}>Next ›</Link> : <span className={`${link} opacity-40`}>Next ›</span>}
          </nav>
        );
      })()}

      <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-2">
        <label className="relative">
          <span className="sr-only">Version</span>
          <select
            value={version.id}
            onChange={(e) => { setVersionId(e.target.value); setSelectedId(null); resetDraft(); setLocalSrc(null); setZoom("fit"); }}
            className="appearance-none rounded-full border border-control bg-white py-1.5 pl-4 pr-9 text-sm"
          >
            {versions.map((v) => <option key={v.id} value={v.id}>Version {v.number}</option>)}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"><Icon name="chevronDown" size={14} /></span>
        </label>
        {canShare && (
          <Link href={`/submit?version=${asset.id}`} className="flex items-center gap-1.5 rounded-full border border-brand px-4 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft" title="Upload a new version of this design for re-review">
            <Icon name="upload" size={14} /> New version
          </Link>
        )}
        {kind !== "audio" && <ZoomControl zoom={zoom} onChange={setZoom} />}
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

      {(asset.instructions || asset.dueAt) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-brand-soft px-5 py-2 text-sm">
          <Icon name="feedback" size={16} />
          <span className="font-medium">
            {people.find((u) => u.id === asset.submittedBy)?.name ?? "A teammate"} asked for your feedback
            {asset.dueAt ? ` by ${formatDue(asset.dueAt, asset.dueTz)}` : ""}
          </span>
          {asset.instructions && <span className="min-w-0 flex-1 truncate text-n-800" title={asset.instructions}>{asset.instructions}</span>}
          {!!asset.approvers?.length && (
            <span className="text-xs text-n-800">Approver: {asset.approvers.map((p) => p.name).join(", ")}</span>
          )}
        </div>
      )}

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
              <div className="flex items-center justify-center gap-3 pb-1 text-sm">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="rounded-full border border-control px-3 py-0.5 disabled:opacity-40">‹</button>
                <span>Page {page} of {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="rounded-full border border-control px-3 py-0.5 disabled:opacity-40">›</button>
              </div>
            </>
          )}
          {timed && (
            <VideoViewer
              key={src}
              audio={kind === "audio"}
              fallbackEmbed={version.embedUrl}
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
          <div className="px-4 pb-3 pt-1">
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
          onStatus={async (id, s) => replace(await repo.setStatus(id, s))}
          onPush={push}
          onPushAll={pushAll}
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
