import { randomUUID } from "node:crypto";
import type { Me } from "@/lib/me/session";
import type { Note, NoteType, NoteVisibility, Report, ReportBody, ReportIndexEntry, ReportStatus } from "@/lib/me/types";
import { deleteDoc, readDoc, updateDoc } from "./doc";
import { AdminError } from "./users";

// A person's private notes and weekly reports. One small document per person (notes), one per week (reports),
// plus a small index so the week list loads without reading every report.
//
// Privacy rules for this file:
//  - Every function takes `Me`, which only `requireMe(req)` can produce. Never accept an email or id from a request.
//  - No admin read path exists, and nothing here is aggregated across people.
//  - Never log note or report text.

const NOTE_TYPES: NoteType[] = ["win", "loss", "blocker", "opportunity", "growth", "one_on_one", "gig", "other"];
const VISIBILITIES: NoteVisibility[] = ["private", "share"];
const MAX_NOTES = 1000;
const MAX_TEXT = 2000;
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

const base = (me: Me) => `me/${me.docId}`;
const now = () => new Date().toISOString();

// ---- Notes ----
type NotesDoc = { notes: Note[] };
const emptyNotes = (): NotesDoc => ({ notes: [] });
const notesName = (me: Me) => `${base(me)}/notes`;

export type NoteInput = { type?: unknown; text?: unknown; visibility?: unknown; krId?: unknown; jiraKey?: unknown; at?: unknown; source?: unknown };

function cleanNote(input: NoteInput, partial: boolean): Partial<Note> {
  const out: Partial<Note> = {};
  if (!partial || input.text !== undefined) {
    const text = String(input.text ?? "").trim().slice(0, MAX_TEXT);
    if (!text) throw new AdminError(400, "Write something for the note.");
    out.text = text;
  }
  if (!partial || input.type !== undefined) {
    const type = String(input.type ?? "other") as NoteType;
    if (!NOTE_TYPES.includes(type)) throw new AdminError(400, "That note type isn't recognized.");
    out.type = type;
  }
  if (input.visibility !== undefined) {
    const v = String(input.visibility) as NoteVisibility;
    if (!VISIBILITIES.includes(v)) throw new AdminError(400, "Visibility must be private or share.");
    out.visibility = v;
  }
  if (input.krId !== undefined) out.krId = String(input.krId).trim().slice(0, 80) || undefined;
  if (input.jiraKey !== undefined) {
    const k = String(input.jiraKey).trim().toUpperCase();
    if (k && !/^[A-Z][A-Z0-9]+-\d+$/.test(k)) throw new AdminError(400, "That doesn't look like a Jira key.");
    out.jiraKey = k || undefined;
  }
  if (input.at !== undefined) {
    const t = Date.parse(String(input.at));
    if (Number.isNaN(t)) throw new AdminError(400, "That date doesn't look right.");
    out.at = new Date(t).toISOString();
  }
  if (input.source !== undefined) out.source = input.source === "interview" ? "interview" : "manual";
  return out;
}

export async function listNotes(me: Me, opts: { from?: string; to?: string } = {}): Promise<Note[]> {
  const { data } = await readDoc(notesName(me), emptyNotes);
  return data.notes
    .filter((n) => (!opts.from || n.at >= opts.from) && (!opts.to || n.at < opts.to))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function addNote(me: Me, input: NoteInput): Promise<Note> {
  const c = cleanNote(input, false);
  const note: Note = {
    id: randomUUID(),
    type: c.type!,
    text: c.text!,
    at: c.at ?? now(),
    visibility: c.visibility ?? "private",
    krId: c.krId,
    jiraKey: c.jiraKey,
    source: c.source ?? "manual",
  };
  return updateDoc(notesName(me), emptyNotes, (d) => {
    if (d.notes.length >= MAX_NOTES) throw new AdminError(400, "You've hit the note limit. Delete some old notes first.");
    d.notes.push(note);
    return { data: d, result: note };
  });
}

export async function updateNote(me: Me, id: string, input: NoteInput): Promise<Note> {
  const c = cleanNote(input, true);
  return updateDoc(notesName(me), emptyNotes, (d) => {
    const i = d.notes.findIndex((n) => n.id === id);
    if (i < 0) throw new AdminError(404, "Note not found.");
    d.notes[i] = { ...d.notes[i], ...c };
    return { data: d, result: d.notes[i] };
  });
}

export async function deleteNote(me: Me, id: string): Promise<void> {
  await updateDoc(notesName(me), emptyNotes, (d) => {
    if (!d.notes.some((n) => n.id === id)) throw new AdminError(404, "Note not found.");
    d.notes = d.notes.filter((n) => n.id !== id);
    return { data: d, result: undefined };
  });
}

// ---- Reports ----
type IndexDoc = { reports: ReportIndexEntry[] };
const emptyIndex = (): IndexDoc => ({ reports: [] });
const indexName = (me: Me) => `${base(me)}/reports-index`;
const reportName = (me: Me, weekStart: string) => `${base(me)}/report-${weekStart}`;

/** A week starts on Monday. Anything else is a bug in the caller, so refuse it rather than store a stray document. */
export function assertWeekStart(weekStart: string): string {
  if (!WEEK_RE.test(weekStart)) throw new AdminError(400, "That week doesn't look right.");
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== weekStart) throw new AdminError(400, "That week doesn't look right.");
  if (d.getUTCDay() !== 1) throw new AdminError(400, "A week starts on Monday.");
  return weekStart;
}

export const emptyBody = (): ReportBody => ({
  kpis: "", whyItMoved: "", owedThisWeek: "", blockers: "", discussionTopics: "", nextSteps: "",
  themes: [], wins: [], losses: [], opportunities: [],
});

const str = (v: unknown) => String(v ?? "").slice(0, 8000);
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim().slice(0, 500)).filter(Boolean).slice(0, 20) : []);

function cleanBody(input: Partial<Record<keyof ReportBody, unknown>>, from: ReportBody): ReportBody {
  const out = { ...from };
  for (const k of ["kpis", "whyItMoved", "owedThisWeek", "blockers", "discussionTopics", "nextSteps"] as const) {
    if (input[k] !== undefined) out[k] = str(input[k]);
  }
  for (const k of ["themes", "wins", "losses", "opportunities"] as const) {
    if (input[k] !== undefined) out[k] = list(input[k]);
  }
  return out;
}

export async function listReports(me: Me): Promise<ReportIndexEntry[]> {
  const { data } = await readDoc(indexName(me), emptyIndex);
  return [...data.reports].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export async function getReport(me: Me, weekStart: string): Promise<Report | null> {
  assertWeekStart(weekStart);
  const { data } = await readDoc<Report | null>(reportName(me, weekStart), () => null);
  return data;
}

export type ReportInput = { body?: Partial<Record<keyof ReportBody, unknown>>; status?: unknown };

/** Creates or edits a week's report. Used by the editor and, later, the generator. */
export async function saveReport(me: Me, weekStart: string, input: ReportInput): Promise<Report> {
  assertWeekStart(weekStart);
  const status: ReportStatus | undefined = input.status === undefined ? undefined : input.status === "final" ? "final" : "draft";
  const report = await updateDoc<Report | null, Report>(reportName(me, weekStart), () => null, (cur) => {
    const t = now();
    const next: Report = {
      weekStart,
      status: status ?? cur?.status ?? "draft",
      body: cleanBody(input.body ?? {}, cur?.body ?? emptyBody()),
      createdAt: cur?.createdAt ?? t,
      updatedAt: t,
    };
    return { data: next, result: next };
  });
  await updateDoc(indexName(me), emptyIndex, (d) => {
    const entry: ReportIndexEntry = { weekStart, status: report.status, updatedAt: report.updatedAt };
    const i = d.reports.findIndex((r) => r.weekStart === weekStart);
    if (i < 0) d.reports.push(entry); else d.reports[i] = entry;
    return { data: d, result: undefined };
  });
  return report;
}

export async function deleteReport(me: Me, weekStart: string): Promise<void> {
  assertWeekStart(weekStart);
  await deleteDoc(reportName(me, weekStart));
  await updateDoc(indexName(me), emptyIndex, (d) => {
    d.reports = d.reports.filter((r) => r.weekStart !== weekStart);
    return { data: d, result: undefined };
  });
}

/** Removes everything this person has stored here. For a "delete my data" control. */
export async function purgeMyData(me: Me): Promise<void> {
  const index = await listReports(me);
  for (const r of index) await deleteDoc(reportName(me, r.weekStart));
  await deleteDoc(indexName(me));
  await deleteDoc(notesName(me));
}
