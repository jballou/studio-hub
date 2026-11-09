"use client";

import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { useMe } from "@/hooks/useMe";
import { isJira, meRepo } from "@/lib/data";
import { marcoText } from "@/lib/me/export";
import { weekStartOf } from "@/lib/me/week";
import type { Note, Report, ReportBody } from "@/lib/me/types";
import { addDay, localDay } from "@/lib/myday/plan";
import { InterviewPanel } from "./InterviewPanel";
import { NoteDialog } from "./NoteDialog";
import { noteLabel } from "./noteMeta";

const field = "mt-2 block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal disabled:bg-n-150";
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

type TextKey = "kpis" | "whyItMoved" | "owedThisWeek" | "blockers" | "discussionTopics" | "nextSteps";
type ListKey = "wins" | "losses" | "opportunities" | "themes";
const TEXT: { key: TextKey; label: string; hint?: string; rows: number }[] = [
  { key: "kpis", label: "Top KPIs and performance", hint: "Filled from Jira and the OKR sheet. Edit if it's off.", rows: 4 },
  { key: "whyItMoved", label: "Last week: what led to the performance", rows: 4 },
  { key: "owedThisWeek", label: "This week: what I owe", rows: 3 },
  { key: "blockers", label: "Issues and blockers", rows: 3 },
  { key: "discussionTopics", label: "Topics to discuss", rows: 3 },
  { key: "nextSteps", label: "Next steps", rows: 3 },
];
const LISTS: { key: ListKey; label: string }[] = [
  { key: "themes", label: "Themes" }, { key: "wins", label: "Wins" }, { key: "losses", label: "Misses" }, { key: "opportunities", label: "Opportunities" },
];
const lines = (xs: string[]) => xs.join("\n");
const unlines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function ReportsView() {
  const me = useMe();
  // The date is read in an effect so "this week" is the person's own, and the server never renders a time-dependent value.
  const [thisWeek, setThisWeek] = useState("");
  const [week, setWeek] = useState("");
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [body, setBody] = useState<ReportBody | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [interview, setInterview] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirm, setConfirm] = useState<"regenerate" | "delete" | null>(null);

  const load = useCallback(async (w: string) => {
    setReport(undefined);
    setError(null);
    try {
      const [r, n] = await Promise.all([meRepo.report(w), meRepo.notes(w)]);
      setReport(r);
      setBody(r?.body ?? null);
      setNotes(n);
    } catch (e) {
      setReport(null);
      setBody(null);
      setError(e instanceof Error ? e.message : "Couldn't load this week.");
    }
  }, []);
  useEffect(() => {
    const w = weekStartOf(localDay());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThisWeek(w);
    setWeek(w);
  }, []);
  useEffect(() => {
    if (!week) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(week); setInterview(false); setInfo(null);
  }, [week, load]);

  const dirty = !!report && !!body && JSON.stringify(body) !== JSON.stringify(report.body);
  const final = report?.status === "final";
  const label = week ? `${day(week)} to ${day(addDay(week, 6))}` : "";

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    setBusy(null);
  };

  const generate = (overwrite: boolean) => run("generate", async () => {
    const r = await meRepo.generate(week, overwrite);
    setReport(r.report);
    setBody(r.report.body);
    setInterview(false);
    setInfo(r.usedModel ? "Drafted from your week. Read it over and edit anything that's off." : "Drafted from your data only, because the writing assistant wasn't available. The narrative is light; edit freely.");
  });
  const save = (status?: "draft" | "final") => run("save", async () => {
    const r = await meRepo.saveReport(week, { body: body ?? undefined, status });
    setReport(r);
    setBody(r.body);
    setInfo(status === "final" ? "Marked final." : "Saved.");
  });
  const remove = () => run("delete", async () => { await meRepo.deleteReport(week); setReport(null); setBody(null); setInfo(null); });
  const copy = () => body && navigator.clipboard.writeText(marcoText(body, day(week))).then(() => setInfo("Copied. Paste it into the MarCo Sheet.")).catch(() => setError("Couldn't copy. Select the text and copy it by hand."));
  const dropNote = (id: string) => run("note", async () => { await meRepo.deleteNote(id); setNotes((ns) => ns.filter((n) => n.id !== id)); });

  if (isJira && me && me.role !== "creative") {
    return <main className="page [&>*:not(.fixed)]:max-w-3xl"><PageTitle>Reports</PageTitle><p className="text-sm text-muted">Weekly reports are for the creative team.</p></main>;
  }

  if (!week) return <main className="page [&>*:not(.fixed)]:max-w-3xl"><PageTitle>Reports</PageTitle><p className="text-sm text-muted">Loading…</p></main>;

  return (
    <main className="page [&>*:not(.fixed)]:max-w-3xl">
      <PageTitle>Reports</PageTitle>
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-bold">Weekly report</h2>
        <Tag tone="info" icon="lock">Only you can see this</Tag>
      </div>
      {!isJira && <div className="mb-4"><Callout tone="info" icon="alert">Demo data. Notes and reports are kept in this browser only.</Callout></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setWeek(addDay(week, -7))} aria-label="Previous week" className="flex h-8 w-8 items-center justify-center rounded-tight border border-control hover:bg-n-150"><span className="rotate-180"><Icon name="chevronRight" size={12} /></span></button>
        <span className="min-w-40 text-center text-sm font-bold" aria-live="polite">{label}</span>
        <button onClick={() => setWeek(addDay(week, 7))} disabled={week >= thisWeek} aria-label="Next week" className="flex h-8 w-8 items-center justify-center rounded-tight border border-control hover:bg-n-150 disabled:opacity-40"><Icon name="chevronRight" size={12} /></button>
        {week !== thisWeek && <button onClick={() => setWeek(thisWeek)} className="btn btn-sm btn-secondary">This week</button>}
        <button onClick={() => setNoteOpen(true)} className="btn btn-md btn-secondary ml-auto"><Icon name="plus" size={16} /> Add a note</button>
      </div>

      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
      {info && !error && <div className="mb-4"><Callout tone="ok" icon="check">{info}</Callout></div>}

      {interview && <div className="mb-4"><InterviewPanel week={week} onFinish={() => generate(!!report)} onClose={() => { setInterview(false); load(week); }} /></div>}

      {report === undefined && <p className="text-sm text-muted">Loading…</p>}

      {report === null && !interview && (
        <section className="card p-6" aria-labelledby="empty-h">
          <h3 id="empty-h" className="text-lg font-bold">No report for this week yet</h3>
          <p className="mb-4 mt-2 text-sm text-muted">The check-in asks a few questions about things Jira can&apos;t see, then drafts your report from your tickets, review comments, notes and calendar. Or skip the questions and draft straight away.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setInterview(true)} className="btn btn-md btn-primary">Start the check-in</button>
            <button onClick={() => generate(false)} disabled={busy !== null} className="btn btn-md btn-secondary">{busy === "generate" ? "Drafting…" : "Draft it now"}</button>
          </div>
        </section>
      )}

      {report && body && (
        <section className="card p-6" aria-label="Report">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Tag tone={final ? "ok" : "neutral"} icon={final ? "check" : "pencil"}>{final ? "Final" : "Draft"}</Tag>
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={copy} className="btn btn-sm btn-secondary">Copy for MarCo</button>
              {!final && <button onClick={() => setInterview(true)} className="btn btn-sm btn-secondary">Check-in</button>}
              {!final && <button onClick={() => (dirty ? setConfirm("regenerate") : generate(true))} disabled={busy !== null} className="btn btn-sm btn-secondary">{busy === "generate" ? "Drafting…" : "Redraft"}</button>}
            </div>
          </div>

          <div className="space-y-4">
            {TEXT.map((f) => (
              <label key={f.key} className="block text-sm font-bold">{f.label}
                {f.hint && <span className="ml-2 text-xs font-normal text-muted">{f.hint}</span>}
                <textarea value={body[f.key]} disabled={final} rows={f.rows} onChange={(e) => setBody({ ...body, [f.key]: e.target.value })} className={field} />
              </label>
            ))}
            <div className="grid gap-4 md:grid-cols-2">
              {LISTS.map((f) => (
                <label key={f.key} className="block text-sm font-bold">{f.label} <span className="text-xs font-normal text-muted">(one per line)</span>
                  <textarea value={lines(body[f.key])} disabled={final} rows={4} onChange={(e) => setBody({ ...body, [f.key]: unlines(e.target.value) })} className={field} />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {!final && <button onClick={() => save()} disabled={!dirty || busy !== null} className="btn btn-md btn-primary">{busy === "save" ? "Saving…" : "Save"}</button>}
            <button onClick={() => save(final ? "draft" : "final")} disabled={busy !== null} className="btn btn-md btn-secondary">{final ? "Reopen as draft" : "Mark final"}</button>
            <button onClick={() => setConfirm("delete")} disabled={busy !== null} className="ml-auto text-sm font-medium text-bad-fg hover:underline">Delete report</button>
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section className="mt-6" aria-labelledby="notes-h">
          <h3 id="notes-h" className="mb-2 text-sm font-bold">Notes from this week ({notes.length})</h3>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2 rounded-tight border border-line bg-white px-4 py-2 text-sm">
                <Tag tone="neutral">{noteLabel(n.type)}</Tag>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{n.text}</span>
                {n.source === "interview" && <span className="shrink-0 text-xs text-muted">check-in</span>}
                <button onClick={() => dropNote(n.id)} aria-label="Delete note" className="shrink-0 text-xs font-medium text-muted hover:underline">Delete</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {noteOpen && <NoteDialog onClose={() => setNoteOpen(false)} onSaved={(n) => { if (n.at.slice(0, 10) >= week && n.at.slice(0, 10) < addDay(week, 7)) setNotes((ns) => [n, ...ns]); }} />}
      {confirm === "regenerate" && <ConfirmDialog title="Redraft this report?" body="You have unsaved edits. Redrafting replaces them with a fresh draft from your week." confirmLabel="Redraft" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); generate(true); }} />}
      {confirm === "delete" && <ConfirmDialog title="Delete this report?" body="This removes the report for this week. Your notes stay, so you can draft it again." confirmLabel="Delete" danger onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); remove(); }} />}
    </main>
  );
}
