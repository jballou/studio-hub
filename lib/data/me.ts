// A person's private notes, weekly reports and weekly interview. Real mode talks to /api/me/*; demo mode keeps everything
// in this browser's localStorage and drafts from a small made-up week, so the screens can be tried without signing in.
import { findGaps, plainNext, MAX_QUESTIONS, type NextQuestion, type Turn } from "@/lib/me/interview";
import { draftFromSignals } from "@/lib/me/reportDraft";
import { weekWindow } from "@/lib/me/week";
import type { WeekSignals } from "@/lib/me/signals";
import type { Note, NoteType, Report, ReportBody, ReportIndexEntry, ReportStatus } from "@/lib/me/types";
import { sampleMirror } from "@/lib/okr/sample";
import { isJira } from "./mode";

export type InterviewState = { asked: string[]; history: Turn[] };
export type InterviewTurn = { next: NextQuestion | null; asked: string[]; history: Turn[]; saved: boolean; total: number; max: number; ai: boolean };
export type Answer = { gapId: string; text: string };

export interface MeRepo {
  notes(week: string): Promise<Note[]>;
  addNote(input: { type: NoteType; text: string }): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  reports(): Promise<ReportIndexEntry[]>;
  report(week: string): Promise<Report | null>;
  saveReport(week: string, input: { body?: Partial<ReportBody>; status?: ReportStatus }): Promise<Report>;
  deleteReport(week: string): Promise<void>;
  generate(week: string, overwrite: boolean): Promise<{ report: Report; usedModel: boolean }>;
  /** One turn of the weekly interview. Pass `answer` to save an answer and get the next question; `text: ""` skips. */
  interview(week: string, state: InterviewState, answer?: Answer): Promise<InterviewTurn>;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Something went wrong (${res.status}).`);
  return body as T;
}
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

const real: MeRepo = {
  notes: async (week) => (await call<{ notes: Note[] }>(`/api/me/notes?week=${week}`)).notes,
  addNote: async (input) => (await call<{ note: Note }>("/api/me/notes", post(input))).note,
  deleteNote: async (id) => { await call(`/api/me/notes/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  reports: async () => (await call<{ reports: ReportIndexEntry[] }>("/api/me/reports")).reports,
  async report(week) {
    const res = await fetch(`/api/me/reports/${week}`, { cache: "no-store" });
    if (res.status === 404) return null;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't load the report (${res.status}).`);
    return body.report;
  },
  saveReport: async (week, input) => (await call<{ report: Report }>(`/api/me/reports/${week}`, { method: "PUT", body: JSON.stringify(input) })).report,
  deleteReport: async (week) => { await call(`/api/me/reports/${week}`, { method: "DELETE" }); },
  generate: (week, overwrite) => call(`/api/me/reports/${week}/generate`, post({ overwrite })),
  interview: (week, state, answer) => call("/api/me/interview", post({ week, ...state, ...(answer ? { answer } : {}) })),
};

// ---- Demo mode ----
const NOTES_KEY = "hub-demo-me-notes";
const REPORTS_KEY = "hub-demo-me-reports";
const read = <T,>(key: string, empty: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return empty; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

function demoSignals(week: string): WeekSignals {
  const w = weekWindow(week);
  const base = { moves: [], dueChanges: 0, overdue: false, done: false };
  const krs = sampleMirror().krs;
  return {
    window: w,
    tickets: [
      { ...base, key: "MKTGCRTV-101", title: "Spring campaign: social ad", status: "Delivered", done: true, closedThisWeek: true, krId: krs[2].id },
      { ...base, key: "MKTGCRTV-102", title: "Product teaser (15s)", status: "Blocked", closedThisWeek: false, flagged: "blocked", dueChanges: 1, krId: krs[3].id },
      { ...base, key: "MKTGCRTV-103", title: "Brand one-pager", status: "In Progress", closedThisWeek: false, krNone: true },
    ],
    review: { commentsWritten: 4, assets: [{ name: "Teaser v2", projectKey: "MKTGCRTV-102" }] },
    tasksDone: [],
    notes: read<Note[]>(NOTES_KEY, []).filter((n) => n.at >= w.fromIso && n.at < w.toIso),
    meetings: [{ title: "EX launch sync", start: `${week}T15:00:00Z`, end: `${week}T16:00:00Z`, attendees: 6 }],
    openAhead: [{ ...base, key: "MKTGCRTV-103", title: "Brand one-pager", status: "In Progress", closedThisWeek: false, due: "2026-11-20" }],
    sources: { jira: { ok: true }, review: { ok: true }, tasks: { ok: true }, notes: { ok: true }, calendar: { ok: true } },
  };
}

const demo: MeRepo = {
  async notes(week) {
    const w = weekWindow(week);
    return read<Note[]>(NOTES_KEY, []).filter((n) => n.at >= w.fromIso && n.at < w.toIso).sort((a, b) => b.at.localeCompare(a.at));
  },
  async addNote(input) {
    const note: Note = { id: uid(), type: input.type, text: input.text.trim(), at: now(), visibility: "private", source: "manual" };
    write(NOTES_KEY, [...read<Note[]>(NOTES_KEY, []), note]);
    return note;
  },
  async deleteNote(id) { write(NOTES_KEY, read<Note[]>(NOTES_KEY, []).filter((n) => n.id !== id)); },
  async reports() {
    return Object.values(read<Record<string, Report>>(REPORTS_KEY, {})).map((r) => ({ weekStart: r.weekStart, status: r.status, updatedAt: r.updatedAt })).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  },
  async report(week) { return read<Record<string, Report>>(REPORTS_KEY, {})[week] ?? null; },
  async saveReport(week, input) {
    const all = read<Record<string, Report>>(REPORTS_KEY, {});
    const cur = all[week];
    const empty: ReportBody = { kpis: "", whyItMoved: "", owedThisWeek: "", blockers: "", discussionTopics: "", nextSteps: "", themes: [], wins: [], losses: [], opportunities: [] };
    const r: Report = { weekStart: week, status: input.status ?? cur?.status ?? "draft", body: { ...(cur?.body ?? empty), ...input.body }, createdAt: cur?.createdAt ?? now(), updatedAt: now() };
    write(REPORTS_KEY, { ...all, [week]: r });
    return r;
  },
  async deleteReport(week) { const all = read<Record<string, Report>>(REPORTS_KEY, {}); delete all[week]; write(REPORTS_KEY, all); },
  async generate(week, overwrite) {
    const cur = read<Record<string, Report>>(REPORTS_KEY, {})[week];
    if (cur?.status === "final") throw new Error("That report is marked final. Reopen it as a draft before regenerating.");
    if (cur && !overwrite) throw new Error("There's already a report for that week. Regenerating replaces it.");
    const s = demoSignals(week);
    const m = sampleMirror();
    const body = draftFromSignals(s, m.krs, { sample: true, openDueNextWeek: s.openAhead });
    return { report: await demo.saveReport(week, { body, status: "draft" }), usedModel: false };
  },
  async interview(week, state, answer) {
    let { asked, history } = state;
    const gaps = findGaps(demoSignals(week));
    let saved = false;
    if (answer) {
      const gap = gaps.find((g) => g.id === answer.gapId);
      if (gap) {
        if (!asked.includes(gap.id)) asked = [...asked, gap.id];
        if (answer.text.trim()) {
          const note: Note = { id: uid(), type: gap.noteType, text: answer.text.trim(), at: now(), visibility: "private", source: "interview", jiraKey: gap.jiraKey, krId: gap.krId };
          write(NOTES_KEY, [...read<Note[]>(NOTES_KEY, []), note]);
          history = [...history, { gapId: gap.id, answer: answer.text.trim() }];
          saved = true;
        }
      }
    }
    return { next: plainNext(gaps, asked), asked, history, saved, total: gaps.length, max: MAX_QUESTIONS, ai: false };
  },
};

export const meRepo: MeRepo = isJira ? real : demo;
