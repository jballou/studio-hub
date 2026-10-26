"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { projectsRepo, repo } from "@/lib/data";
import { parseSource } from "@/lib/sources";
import type { Asset, AssetKind, Device, Project, SourceKind, User } from "@/lib/types";

const SOURCES: { id: SourceKind; label: string; hint: string; icon: IconName; placeholder?: string }[] = [
  { id: "figma", label: "Figma frame", hint: "Link to one frame", icon: "link", placeholder: "https://www.figma.com/design/…?node-id=12-34" },
  { id: "staging", label: "Landing page", hint: "Staging link", icon: "link", placeholder: "https://staging.example.com/landing" },
  { id: "drive", label: "Google Drive", hint: "Video, audio, image or PDF", icon: "link", placeholder: "https://drive.google.com/file/d/…/view" },
  { id: "slides", label: "Google Slides", hint: "Deck link", icon: "link", placeholder: "https://docs.google.com/presentation/d/…/edit" },
  { id: "upload", label: "Upload a file", hint: "Image, video, audio, PDF", icon: "upload" },
];

function kindFromFile(f: File): AssetKind | null {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("audio/")) return "audio";
  if (f.type === "application/pdf") return "pdf";
  return null;
}

const field = "w-full rounded-lg border border-control bg-white px-3 py-2 text-sm";

export function SubmitForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [source, setSource] = useState<SourceKind>("figma");
  const [url, setUrl] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [projectKey, setProjectKey] = useState("");
  const [target, setTarget] = useState(""); // "" = new asset, else existing asset id
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    repo.listUsers().then(setUsers);
    repo.listAssets().then(setAssets);
    projectsRepo.listProjects("u-avery").then((p) => {
      setProjects(p);
      const ticket = params.get("ticket");
      setProjectKey((k) => k || (ticket && p.some((x) => x.jiraKey === ticket) ? ticket : p[0]?.jiraKey || ""));
    });
  }, [params]);

  const parsed = useMemo(
    () => (source === "upload" ? null : parseSource(source, url, device)),
    [source, url, device],
  );
  const fileKind = file ? kindFromFile(file) : null;

  const sourceOk = source === "upload" ? !!file && !!fileKind : !!parsed && parsed.ok;
  const versionTargets = assets.filter((a) => a.projectKey === projectKey);
  const finalTitle = title.trim() || (parsed?.ok ? parsed.suggestedTitle : file?.name ?? "");
  const valid = sourceOk && !!finalTitle && !!projectKey && reviewerIds.length > 0 && !!dueDate;

  const toggleReviewer = (id: string) => setReviewerIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const submit = async () => {
    setBusy(true);
    const common = { title: finalTitle, projectKey, existingAssetId: target || null, reviewerIds, dueDate, instructions: instructions.trim(), submittedBy: "u-avery" };
    let res;
    if (source === "upload" && file && fileKind) {
      res = await repo.submitForReview({
        ...common, assetKind: fileKind, src: URL.createObjectURL(file),
        aspect: fileKind === "pdf" ? 8.5 / 11 : 16 / 9,
        source: { kind: "upload", url: "", label: file.name },
      });
    } else if (parsed?.ok && source !== "upload") {
      res = await repo.submitForReview({
        ...common, assetKind: "embed", src: "", embedUrl: parsed.embedUrl, aspect: parsed.aspect,
        source: { kind: source, url: url.trim(), label: parsed.summary },
      });
    } else {
      setBusy(false);
      return;
    }
    router.push(`/review/${res.assetId}`);
  };

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Submit for feedback</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Share what you want reviewed. Reviewers get a link and can comment right on it.</p>

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-semibold">What are you sharing?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SOURCES.map((s) => (
            <label key={s.id} className={`cursor-pointer rounded-xl border bg-white p-3 text-sm ${source === s.id ? "border-brand ring-2 ring-brand-soft" : "border-line hover:border-control"}`}>
              <input type="radio" name="source" className="sr-only" checked={source === s.id} onChange={() => { setSource(s.id); setUrl(""); setFile(null); }} />
              <span className="flex items-center gap-2 font-medium"><Icon name={s.icon} size={16} /> {s.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{s.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="mb-6">
        {source === "upload" ? (
          <label className="block text-sm font-semibold">File
            <input
              type="file"
              accept="image/*,video/*,audio/*,application/pdf"
              className={`${field} mt-1 font-normal`}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && !fileKind && <span role="alert" className="mt-1 block text-xs font-normal text-bad-fg">That file type isn&apos;t supported. Use an image, video, audio or PDF.</span>}
          </label>
        ) : (
          <>
            <label className="block text-sm font-semibold">Link
              <input
                className={`${field} mt-1 font-normal`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={SOURCES.find((s) => s.id === source)?.placeholder}
                inputMode="url"
                autoComplete="off"
              />
            </label>
            {source === "staging" && (
              <label className="mt-2 flex items-center gap-2 text-sm">Preview as
                <select value={device} onChange={(e) => setDevice(e.target.value as Device)} className="rounded border border-control px-2 py-1">
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                </select>
              </label>
            )}
            {parsed && !parsed.ok && parsed.error && (
              <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-bad-fg"><Icon name="close" size={16} /> {parsed.error}</p>
            )}
            {parsed?.ok && (
              <div className="mt-2 space-y-1.5 rounded-xl border border-ok-line bg-ok-bg p-3 text-sm text-ok-fg">
                <p className="flex items-center gap-1.5 font-medium"><Icon name="check" size={16} /> {parsed.summary}</p>
                {parsed.warnings.map((w) => (
                  <p key={w} className="flex items-start gap-1.5 text-xs text-warn-fg"><Icon name="alert" size={14} /> {w}</p>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold sm:col-span-2">Title
          <input className={`${field} mt-1 font-normal`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={parsed?.ok ? parsed.suggestedTitle : file?.name ?? "Name this design"} />
        </label>
        <label className="block text-sm font-semibold">Jira ticket
          <select className={`${field} mt-1 font-normal`} value={projectKey} onChange={(e) => { setProjectKey(e.target.value); setTarget(""); }}>
            {projects.map((p) => <option key={p.id} value={p.jiraKey}>{p.jiraKey} · {p.title}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Add as
          <select className={`${field} mt-1 font-normal`} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">A new design</option>
            {versionTargets.map((a) => <option key={a.id} value={a.id}>New version of “{a.name}”</option>)}
          </select>
        </label>
      </section>

      <section className="mb-6 space-y-4">
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Who should review it?</legend>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <label key={u.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${reviewerIds.includes(u.id) ? "border-brand bg-brand-soft" : "border-control bg-white"}`}>
                <input type="checkbox" className="sr-only" checked={reviewerIds.includes(u.id)} onChange={() => toggleReviewer(u.id)} />
                {reviewerIds.includes(u.id) && <Icon name="check" size={14} />}
                {u.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold sm:w-1/2">Feedback needed by
          <input type="date" className={`${field} mt-1 font-normal`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">What feedback do you want?
          <textarea rows={3} className={`${field} mt-1 font-normal`} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Is the headline clear? Ignore the placeholder photo." />
        </label>
      </section>

      <button onClick={submit} disabled={!valid || busy} className="rounded-lg bg-brand px-6 py-2.5 font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">
        {busy ? "Sending…" : "Send for feedback"}
      </button>
      {!valid && <p className="mt-2 text-xs text-muted">Add a valid link or file, at least one reviewer, and a due date.</p>}
    </main>
  );
}
