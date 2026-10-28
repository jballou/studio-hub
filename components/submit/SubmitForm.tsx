"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DatePicker } from "@/components/ui/DatePicker";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { Callout, Tag } from "@/components/ui/Tag";
import { TicketPicker } from "./TicketPicker";
import { FramePicker } from "./FramePicker";
import { UploadZone, type Upload } from "./UploadZone";
import { uploadReviewFile } from "@/lib/data/uploads";
import { useMe } from "@/hooks/useMe";
import { isJira, peopleRepo, projectsRepo, repo } from "@/lib/data";
import { addedFrameIds, defaultBatchTitle, figmaFrameItem, itemKey, toSubmitInput, type BatchInfo, type BatchItem } from "@/lib/batch";
import { parseFigmaLink } from "@/lib/figma";
import { parseSource, SHAPES, type DriveType, type Shape } from "@/lib/sources";
import { AUDIO_EXTENSIONS, MAX_UPLOAD_BYTES, kindFromFile, mimeOf } from "@/lib/media";
import { localTimezone, timezoneOptions, zonedToInstant } from "@/lib/time";
import type { Asset, AssetKind, Device, Person, Project, SourceKind } from "@/lib/types";

const SOURCES: { id: SourceKind; label: string; hint: string; icon: IconName; placeholder?: string }[] = [
  { id: "figma", label: "Figma frame", hint: "One frame, or pick several", icon: "link", placeholder: "https://www.figma.com/design/…?node-id=12-34" },
  { id: "staging", label: "Landing page", hint: "Staging link", icon: "link", placeholder: "https://staging.example.com/landing" },
  { id: "drive", label: "Google Drive", hint: "Video, audio (MP3, M4A, WAV…), image or PDF", icon: "link", placeholder: "https://drive.google.com/file/d/…/view" },
  { id: "slides", label: "Google Slides", hint: "Deck link", icon: "link", placeholder: "https://docs.google.com/presentation/d/…/edit" },
  { id: "lottie", label: "LottieFiles", hint: "Animation link", icon: "link", placeholder: "https://lottiefiles.com/animations/… or a lottie.host embed link" },
  { id: "upload", label: "Upload files", hint: "Image, video, audio (MP3, M4A, WAV…), PDF. Pick several.", icon: "upload" },
];

const KIND_LABEL: Record<AssetKind, string> = { image: "Image", video: "Video", audio: "Audio", pdf: "PDF", embed: "Link" };
const field = "w-full rounded-lg border border-control bg-white px-4 py-2 text-sm";

export function SubmitForm() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ticket, setTicket] = useState<Project | null>(null);
  const [source, setSource] = useState<SourceKind>("figma");
  const [url, setUrl] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const [shape, setShape] = useState<Shape>("16:10");
  const [driveType, setDriveType] = useState<DriveType>("other");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [uploadNote, setUploadNote] = useState<{ bad: string[]; cantPlay: string[] } | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploadFailed, setUploadFailed] = useState<string[]>([]);
  const cancels = useRef(new Map<string, () => void>());
  const [versionOf, setVersionOf] = useState<Asset | null>(null);
  const [picker, setPicker] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [target, setTarget] = useState(""); // "" = new asset, else existing asset id
  const [reviewers, setReviewers] = useState<Person[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("17:00");
  const [dueTz, setDueTz] = useState("UTC");
  const [approvers, setApprovers] = useState<Person[]>([]);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDueTz(localTimezone());
    repo.listAssets().then(setAssets);
    const want = params.get("ticket");
    if (want) projectsRepo.getProject(want, "u-avery").then((p) => p && setTicket((t) => t ?? p));
  }, [params]);

  // "New version" from a review page: carry over the design, ticket and people so only the new file is needed.
  useEffect(() => {
    const vid = params.get("version");
    if (!vid) return;
    let live = true;
    repo.getAsset(vid).then(async (a) => {
      if (!a || !live) return;
      const p = await projectsRepo.getProject(a.projectKey, "u-avery");
      if (!live) return;
      if (p) setTicket(p);
      setTarget(a.id);
      setVersionOf(a);
      setSource(a.source?.kind ?? "upload");
      setReviewers(a.reviewers ?? []);
      setApprovers(a.approvers ?? []);
    });
    return () => { live = false; };
  }, [params]);

  // Default the approver to the ticket's requester when we know who that is.
  useEffect(() => {
    if (!ticket?.requesterId) return;
    let live = true;
    (async () => {
      const person: Person | undefined = ticket.requesterName
        ? { id: ticket.requesterId, name: ticket.requesterName }
        : (await peopleRepo.search("")).find((p) => p.id === ticket.requesterId);
      if (live && person) setApprovers((a) => (a.length ? a : [person]));
    })();
    return () => { live = false; };
  }, [ticket]);

  const parsed = useMemo(
    () => (source === "upload" ? null : parseSource(source, url, device, shape, driveType)),
    [source, url, device, shape, driveType],
  );
  const figmaLink = source === "figma" && parsed?.ok ? parseFigmaLink(url) : null;

  // The link in the box counts as the next item without needing a click, so one link and one Send still works.
  const pending: BatchItem | null = useMemo(() => {
    if (source === "upload" || !parsed?.ok) return null;
    const media = parsed.media;
    return {
      key: `pending-${source}-${url.trim()}`,
      title: parsed.suggestedTitle,
      source: { kind: source, url: url.trim(), label: parsed.summary },
      assetKind: media?.kind ?? "embed",
      src: media?.streamUrl ?? "",
      embedUrl: parsed.embedUrl,
      aspect: parsed.aspect,
      baseWidth: parsed.baseWidth,
    };
  }, [source, parsed, url]);

  const all = useMemo(() => [...items, ...(pending && !items.some((i) => i.source.url && i.source.url === pending.source.url) ? [pending] : [])], [items, pending]);
  const isBatch = all.length > 1;
  const projectKey = ticket?.jiraKey ?? "";
  const versionTargets = assets.filter((a) => a.projectKey === projectKey);
  const itemTitle = (it: BatchItem) => (!isBatch && title.trim() ? title.trim() : it.title.trim());
  const batchTitle = title.trim() || defaultBatchTitle(all);
  const valid = all.length > 0 && all.every((i) => !!itemTitle(i)) && !!projectKey && reviewers.length > 0 && approvers.length > 0 && !!dueDate && !!dueTime;

  // Files stay in the browser; reading them is the "upload" and gives real progress for big videos.
  const addFiles = (list: File[]) => {
    if (!list.length) return;
    setUploadFailed([]);
    const bad: string[] = [];
    const cantPlay: string[] = [];
    for (const f of list) {
      const kind = kindFromFile(f);
      if (!kind) { bad.push(f.name); continue; }
      if (isJira && f.size > MAX_UPLOAD_BYTES) { setUploadFailed((cur) => [...cur, `${f.name}: that's ${(f.size / 1e6).toFixed(0)} MB and uploads are limited to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB for now. For bigger videos, share a Google Drive or Figma link instead.`]); continue; }
      // Warn (don't block) when this browser can't play it, e.g. AIFF outside Safari. Reviewers may be on other browsers too.
      const mime = mimeOf(f);
      if (kind === "audio" && mime && document.createElement("audio").canPlayType(mime) === "") cantPlay.push(f.name);
      void ingest(f, kind);
    }
    setUploadNote(bad.length || cantPlay.length ? { bad, cantPlay } : null);
  };

  const ingest = async (f: File, kind: AssetKind) => {
    const id = itemKey();
    const start = performance.now();
    let cancelled = false;
    const abort = new AbortController();
    cancels.current.set(id, () => { cancelled = true; abort.abort(); });
    setUploads((u) => [...u, { id, name: f.name, size: f.size, progress: 0, secondsLeft: null }]);
    const tick = (p: number) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p, secondsLeft: p > 0.02 ? Math.ceil(((performance.now() - start) / p) * (1 - p) / 1000) : null } : x)));
    try {
      let src: string;
      if (isJira) {
        // Real mode: the file is sent to the Hub in small pieces, so it outlives this tab and reviewers can open it.
        src = (await uploadReviewFile(f, tick, abort.signal)).url;
      } else {
        // Demo: files stay in this tab; reading them gives real progress for big videos.
        const reader = f.stream().getReader();
        let read = 0;
        let last = 0;
        for (;;) {
          if (cancelled) { await reader.cancel(); return; }
          const { done, value } = await reader.read();
          if (done) break;
          read += value.length;
          if (performance.now() - last > 60) { last = performance.now(); tick(f.size ? read / f.size : 1); }
        }
        src = URL.createObjectURL(f);
      }
      tick(1);
      await new Promise((r) => setTimeout(r, 350)); // let the full bar show before the card moves into the list
      if (cancelled) return;
      const item: BatchItem = {
        key: id, title: f.name.replace(/\.[^.]+$/, ""), assetKind: kind, src,
        aspect: kind === "pdf" ? 8.5 / 11 : 16 / 9, source: { kind: "upload", url: "", label: f.name },
        thumb: kind === "image" ? src : undefined,
      };
      setItems((cur) => [...cur, item]);
    } catch (e) {
      if (!cancelled) setUploadFailed((cur) => [...cur, `${f.name}: ${e instanceof Error && e.message ? e.message : "the upload didn't finish."}`]);
    } finally {
      cancels.current.delete(id);
      setUploads((u) => u.filter((x) => x.id !== id));
    }
  };

  const cancelUpload = (id: string) => { cancels.current.get(id)?.(); setUploads((u) => u.filter((x) => x.id !== id)); };

  const addPending = () => {
    if (!pending) return;
    setItems((cur) => [...cur, { ...pending, key: itemKey(), title: title.trim() || pending.title }]);
    setUrl("");
    setTitle("");
  };

  const addBulk = () => {
    const errs: string[] = [];
    const next: BatchItem[] = [];
    for (const line of bulk.split(/\s+/).map((l) => l.trim()).filter(Boolean)) {
      const p = parseSource("figma", line, device, shape);
      if (!p.ok) { errs.push(line); continue; }
      const link = parseFigmaLink(line);
      next.push({
        key: itemKey(), title: link?.nodeId ? `Frame ${link.nodeId}` : p.suggestedTitle, source: { kind: "figma", url: line, label: p.summary },
        assetKind: "embed", src: "", embedUrl: p.embedUrl, aspect: p.aspect, baseWidth: p.baseWidth,
      });
    }
    setItems((cur) => [...cur, ...next]);
    setBulkErrors(errs);
    if (!errs.length) { setBulk(""); setBulkOpen(false); }
    else setBulk(errs.join("\n"));
  };

  const removeItem = (key: string) => setItems((cur) => cur.filter((i) => i.key !== key));
  const rename = (key: string, t: string) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, title: t } : i)));

  const submit = async () => {
    setBusy(true);
    const common = { projectKey, existingAssetId: !isBatch ? target || null : null, reviewers: [...new Map([...reviewers, ...approvers].map((p) => [p.id, p])).values()], approvers, dueAt: zonedToInstant(dueDate, dueTime, dueTz), dueTz, instructions: instructions.trim(), submittedBy: me?.id ?? "u-avery" };
    const batchId = isBatch ? crypto.randomUUID() : null;
    let first: string | null = null;
    for (const [index, it] of all.entries()) {
      const batch: BatchInfo | undefined = batchId ? { id: batchId, title: batchTitle, index, total: all.length } : undefined;
      const res = await repo.submitForReview(toSubmitInput({ ...it, title: itemTitle(it) }, common, batch));
      first ??= res.assetId;
    }
    if (first) router.push(`/review/${first}`);
    else setBusy(false);
  };

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{versionOf ? "Upload a new version" : "Submit for feedback"}</h1>
      {versionOf && (
        <p className="mt-2 rounded-xl border border-info-line bg-info-bg px-4 py-4 text-sm text-info-fg">
          This will be <b>version {versionOf.versionIds.length + 1}</b> of “{versionOf.name}”. Reviewers and approvers are carried over (change them below if needed), and it goes back to awaiting feedback. Add one file or link.
        </p>
      )}
      <p className="mb-6 mt-2 text-sm text-muted">Share what you want reviewed. Reviewers get a link and can comment right on it. Add several items to send them as one batch.</p>

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-semibold">What are you sharing?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SOURCES.map((s) => (
            <label key={s.id} className={`cursor-pointer rounded-xl border bg-white p-4 text-sm ${source === s.id ? "border-brand ring-2 ring-brand-soft" : "border-line hover:border-control"}`}>
              <input type="radio" name="source" className="sr-only" checked={source === s.id} onChange={() => { setSource(s.id); setUrl(""); setDriveType("other"); setBulkOpen(false); }} />
              <span className="flex items-center gap-2 font-medium"><Icon name={s.icon} size={16} /> {s.label}</span>
              <span className="mt-0 block text-xs text-muted">{s.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="mb-4">
        {source === "upload" ? (
          <div>
            <span className="mb-2 block text-sm font-semibold">Files</span>
            <UploadZone uploads={uploads} onFiles={addFiles} onCancel={cancelUpload} hint={`Image, video, audio (MP3, M4A, WAV…) or PDF${isJira ? `, up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB each` : ""}. Audio is played in the browser and each comment is stamped with the time.`} />
            {uploadFailed.length > 0 && <span role="alert" className="mt-2 block text-xs text-bad-fg">Couldn&apos;t upload {uploadFailed.join(" · ")}</span>}
            {uploadNote?.bad.length ? <span role="alert" className="mt-2 block text-xs text-bad-fg">Skipped {uploadNote.bad.join(", ")}: that file type isn&apos;t supported. Use an image, video, audio ({AUDIO_EXTENSIONS.slice(0, 6).join(", ")}…) or PDF.</span> : null}
            {uploadNote?.cantPlay.length ? <span role="alert" className="mt-2 block text-xs text-warn-fg">This browser can&apos;t play {uploadNote.cantPlay.join(", ")}, so some reviewers may not either. MP3, M4A and WAV work everywhere.</span> : null}
          </div>
        ) : (
          <>
            <label className="block text-sm font-semibold">Link
              <input
                className={`${field} mt-2 font-normal`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={SOURCES.find((s) => s.id === source)?.placeholder}
                inputMode="url"
                autoComplete="off"
              />
            </label>
            {source === "staging" && (
              <label className="mt-2 flex items-center gap-2 text-sm">Preview as
                <select value={device} onChange={(e) => setDevice(e.target.value as Device)} className="rounded border border-control px-2 py-2">
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                </select>
              </label>
            )}
            {parsed && !parsed.ok && parsed.error && (
              <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-bad-fg"><Icon name="close" size={16} /> {parsed.error}</p>
            )}
            {source === "drive" && (
              <fieldset className="mt-4">
                <legend className="text-sm font-semibold">What kind of file is it?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([["other", "Image, PDF or other"], ["video", "Video"], ["audio", "Audio"]] as const).map(([id, label]) => (
                    <label key={id} className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${driveType === id ? "border-brand bg-brand-soft font-medium" : "border-control bg-white hover:bg-brand-soft"}`}>
                      <input type="radio" name="drive-type" className="sr-only" checked={driveType === id} onChange={() => setDriveType(id)} />{label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Video and audio get a player with timestamped comments.</p>
              </fieldset>
            )}
            {(source === "figma" || (source === "drive" && driveType !== "audio")) && (
              <label className="mt-2 flex items-center gap-2 text-sm">Frame shape
                <select value={shape} onChange={(e) => setShape(e.target.value as Shape)} className="rounded border border-control px-2 py-2">
                  {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <span className="text-xs text-muted">Match your frame so pins stay put.</span>
              </label>
            )}
            {parsed?.ok && (
              <div className="mt-2 space-y-2 rounded-xl border border-ok-line bg-ok-bg p-4 text-sm text-ok-fg">
                <p className="flex items-center gap-2 font-medium"><Icon name="check" size={16} /> {parsed.summary}</p>
                {parsed.warnings.map((w) => (
                  <p key={w} className="flex items-start gap-2 text-xs text-warn-fg"><Icon name="alert" size={14} /> {w}</p>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {figmaLink && (
                <button type="button" onClick={() => setPicker(true)} className={figmaLink.nodeId ? "rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft" : "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 hover:bg-brand-dark"}>
                  {figmaLink.nodeId ? "Add more frames from this file…" : "Choose frames from this file…"}
                </button>
              )}
              {pending && (
                <button type="button" onClick={addPending} className="rounded-lg border border-control bg-white px-4 py-2 text-sm font-medium hover:bg-brand-soft">+ Add to batch</button>
              )}
              {source === "figma" && (
                <button type="button" onClick={() => setBulkOpen(!bulkOpen)} aria-expanded={bulkOpen} className="text-sm font-medium text-brand hover:underline">Add several links</button>
              )}
            </div>
            {bulkOpen && source === "figma" && (
              <div className="mt-2 rounded-xl border border-line bg-white p-4">
                <label className="block text-sm font-semibold">Frame links, one per line
                  <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"https://www.figma.com/design/…?node-id=12-34\nhttps://www.figma.com/design/…?node-id=12-35"} className={`${field} mt-2 font-mono text-xs font-normal`} />
                </label>
                {bulkErrors.length > 0 && <p role="alert" className="mt-2 text-xs text-bad-fg">These didn&apos;t look like Figma design links and were left in the box: {bulkErrors.length}.</p>}
                <button type="button" onClick={addBulk} disabled={!bulk.trim()} className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">Add links</button>
              </div>
            )}
          </>
        )}
      </section>

      {all.length > 0 && (
        <section className="mb-6" aria-label="In this submission">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            {isBatch ? `Batch of ${all.length}` : "1 item"}
            {isBatch && <Tag tone="info">Reviewers see these together</Tag>}
          </h2>
          <ul className="space-y-2">
            {all.map((it) => {
              const staged = items.some((i) => i.key === it.key);
              return (
                <li key={it.key} className="flex items-center gap-4 rounded-xl border border-line bg-white p-2">
                  <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-n-150 text-muted">
                    {it.thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={it.thumb} alt="" className="h-full w-full object-cover" />
                      : <Icon name={it.assetKind === "audio" || it.assetKind === "video" ? "progress" : "link"} size={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {staged && isBatch
                      ? <input value={it.title} onChange={(e) => rename(it.key, e.target.value)} aria-label="Item name" className="w-full rounded border border-transparent px-2 py-0 text-sm font-medium hover:border-control focus:border-brand" />
                      : <span className="block truncate px-2 text-sm font-medium">{itemTitle(it) || "Untitled"}</span>}
                    <span className="block truncate px-2 text-xs text-muted">{KIND_LABEL[it.assetKind]} · {it.source.label}{staged ? "" : " · in the link box"}</span>
                  </span>
                  {staged && <button type="button" onClick={() => removeItem(it.key)} aria-label={`Remove ${it.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-n-150"><Icon name="x" size={14} /></button>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold sm:col-span-2">{isBatch ? "Batch name" : "Title"}
          <input className={`${field} mt-2 font-normal`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isBatch ? defaultBatchTitle(all) : all[0]?.title ?? "Name this design"} />
        </label>
        <div className="block text-sm font-semibold">
          <label htmlFor="ticket-search">Jira ticket</label>
          <TicketPicker value={ticket} onChange={(p) => { setTicket(p); setTarget(""); }} viewerId="u-avery" />
        </div>
        {!isBatch && (
          <label className="block text-sm font-semibold">Add as
            <select className={`${field} mt-2 font-normal`} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">A new design</option>
              {versionTargets.map((a) => <option key={a.id} value={a.id}>New version of “{a.name}”</option>)}
            </select>
          </label>
        )}
      </section>

      <section className="mb-6 space-y-4">
        <PeoplePicker label="Who should review it?" value={reviewers} onChange={setReviewers} placeholder="Search by name" />
        <PeoplePicker
          label="Who can mark it approved?"
          value={approvers}
          onChange={setApprovers}
          placeholder="Search by name"
          hint="Only these people see the approve button. Everyone else can comment or ask for changes. Approvers are added as reviewers."
        />
        <div>
          <span className="text-sm font-semibold">Feedback needed by</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="w-48"><DatePicker ariaLabel="Date" value={dueDate} onChange={setDueDate} /></div>
            <input aria-label="Time" type="time" className={`${field} w-32 font-normal`} value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            <select aria-label="Timezone" className={`${field} min-w-56 flex-1 font-normal`} value={dueTz} onChange={(e) => setDueTz(e.target.value)}>
              {timezoneOptions(dueTz).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <label className="block text-sm font-semibold">What feedback do you want?
          <textarea rows={3} className={`${field} mt-2 font-normal`} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Is the headline clear? Ignore the placeholder photo." />
        </label>
      </section>

      <button onClick={submit} disabled={!valid || busy} className="rounded-lg bg-brand px-6 py-2 font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">
        {busy ? "Sending…" : isBatch ? `Send ${all.length} items for feedback` : "Send for feedback"}
      </button>
      {!valid && <p className="mt-2 text-xs text-muted">Add a valid link or file, at least one reviewer, one approver, and a due date and time.</p>}

      {picker && (
        <FramePicker
          url={url}
          alreadyAdded={figmaLink ? addedFrameIds(items, figmaLink.key) : new Set()}
          onBack={() => setPicker(false)}
          onCancel={() => setPicker(false)}
          onImport={(file, chosen) => {
            const next = chosen.map((c) => figmaFrameItem({ key: file.key, name: file.name, pages: [] }, c.frame, c.thumb)).filter((x): x is BatchItem => !!x);
            setItems((cur) => [...cur, ...next.filter((n) => !cur.some((c) => c.key === n.key))]);
            setUrl("");
            setPicker(false);
          }}
        />
      )}
      {isBatch && <p className="mt-4"><Callout tone="info" icon="check">Each item gets its own comments. Reviewers move between them with Previous and Next.</Callout></p>}
    </main>
  );
}
