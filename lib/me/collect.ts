// Gathers one person's week from the Hub's own sources: Jira, review comments, My Day tasks, their notes and their calendar.
// Everything here runs as the signed-in person (their Jira token, their Google connection, their own documents), so it can
// only ever see what they can see. A source that fails is reported in `sources` and the rest still come back.
import { listEvents } from "@/lib/google/client";
import { searchIssues, searchIssuesWithChangelog } from "@/lib/jira/client";
import { PROJECT_KEY } from "@/lib/jira/map";
import { flagOf } from "@/lib/jira/map";
import type { JiraSession } from "@/lib/jira/session";
import { krFromLabels } from "@/lib/okr/label";
import { getConnection } from "@/lib/store/google";
import { listNotes } from "@/lib/store/me";
import { listAssets, listThreads } from "@/lib/store/review";
import { listTasks } from "@/lib/store/tasks";
import type { Me } from "./session";
import type { MeetingSignal, ReviewSignal, SourceName, SourceStatus, TaskSignal, TicketSignal, WeekSignals } from "./signals";
import { inWindow, weekWindow } from "./week";

const TICKET_FIELDS = ["summary", "status", "duedate", "resolutiondate", "labels"];
const MAX_TICKETS = 40;
const MAX_VERSIONS = 40;

const ok = (): SourceStatus => ({ ok: true });
const failed = (e: unknown, fallback: string): SourceStatus => ({ ok: false, note: e instanceof Error && e.message ? e.message.slice(0, 160) : fallback });

async function jiraTickets(s: JiraSession, w: ReturnType<typeof weekWindow>): Promise<TicketSignal[]> {
  // Work I'm assigned that changed this week. Created-only tickets and tickets I merely watch stay out.
  const jql = `project = ${PROJECT_KEY} AND assignee = currentUser() AND updated >= "${w.weekStart}" ORDER BY updated DESC`;
  const issues = await searchIssuesWithChangelog(s.auth, jql, TICKET_FIELDS, MAX_TICKETS);
  return issues.map((i): TicketSignal => {
    const f = i.fields;
    const histories = (i.changelog?.histories ?? []).filter((h) => inWindow(h.created, w)).sort((a, b) => a.created.localeCompare(b.created));
    const moves = histories.flatMap((h) => h.items.filter((x) => x.field === "status" && x.toString).map((x) => ({ to: String(x.toString), at: h.created })));
    const dueChanges = histories.filter((h) => h.items.some((x) => x.field === "duedate")).length;
    const done = f.status.statusCategory.key === "done";
    const due = f.duedate ?? undefined;
    const kr = krFromLabels(f.labels);
    return {
      key: i.key,
      title: f.summary,
      status: f.status.name,
      done,
      krId: kr.krId,
      krNone: kr.none,
      moves,
      closedThisWeek: inWindow(typeof f.resolutiondate === "string" ? new Date(f.resolutiondate).toISOString() : undefined, w),
      due,
      dueChanges,
      overdue: !done && !!due && due < w.weekEnd,
      flagged: flagOf(i),
    };
  });
}

/** Open work with a due date, soonest first: what's coming up. */
async function openAheadTickets(s: JiraSession, w: ReturnType<typeof weekWindow>): Promise<TicketSignal[]> {
  const jql = `project = ${PROJECT_KEY} AND assignee = currentUser() AND statusCategory != Done AND duedate IS NOT EMPTY ORDER BY duedate ASC`;
  const issues = await searchIssues(s.auth, jql, ["summary", "status", "duedate", "labels"], 10);
  return issues.map((i): TicketSignal => {
    const kr = krFromLabels(i.fields.labels);
    const due = i.fields.duedate ?? undefined;
    return { key: i.key, title: i.fields.summary, status: i.fields.status.name, done: false, krId: kr.krId, krNone: kr.none, moves: [], closedThisWeek: false, due, dueChanges: 0, overdue: !!due && due < w.weekEnd, flagged: flagOf(i) };
  });
}

async function reviewActivity(s: JiraSession, w: ReturnType<typeof weekWindow>, projectKeys: Set<string>): Promise<ReviewSignal> {
  const who = { accountId: s.accountId, name: s.name, email: s.email, role: s.role };
  const assets = (await listAssets(who)).filter((a) => projectKeys.has(a.projectKey));
  const versions = assets.flatMap((a) => a.versionIds.map((v) => ({ v, a }))).slice(-MAX_VERSIONS);
  let commentsWritten = 0;
  const touched = new Map<string, { name: string; projectKey: string }>();
  for (const { v, a } of versions) {
    const threads = await listThreads(who, v).catch(() => []);
    for (const t of threads) {
      const mine = t.comments.filter((c) => c.authorId === s.accountId && inWindow(c.createdAt, w));
      if (mine.length) { commentsWritten += mine.length; touched.set(a.id, { name: a.name, projectKey: a.projectKey }); }
    }
  }
  return { commentsWritten, assets: [...touched.values()] };
}

async function tasksDone(me: Me, w: ReturnType<typeof weekWindow>): Promise<TaskSignal[]> {
  const { tasks } = await listTasks(me.email);
  return tasks.filter((t) => !t.deleted && t.done && inWindow(t.doneAt, w)).map((t) => ({ title: t.title, doneAt: t.doneAt! }));
}

async function meetings(me: Me, w: ReturnType<typeof weekWindow>): Promise<{ list: MeetingSignal[]; status: SourceStatus }> {
  if (!(await getConnection(me.email))) return { list: [], status: { ok: false, note: "Google isn't connected, so there's no calendar to read." } };
  const events = await listEvents(me.email, w.fromIso, w.toIso);
  const list = events
    .filter((e) => !e.allDay && e.response !== "declined")
    .map((e): MeetingSignal => ({ title: e.title, start: e.start, end: e.end, attendees: e.attendees }));
  return { list, status: ok() };
}

/** One person's week. `me` and `session` both come from the request cookie; neither is ever taken from the URL or body. */
export async function collectSignals(me: Me, session: JiraSession, weekStart: string): Promise<WeekSignals> {
  const w = weekWindow(weekStart);
  const sources = {} as Record<SourceName, SourceStatus>;

  const [jira, notes, tasks, cal, ahead] = await Promise.allSettled([jiraTickets(session, w), listNotes(me, { from: w.fromIso, to: w.toIso }), tasksDone(me, w), meetings(me, w), openAheadTickets(session, w)]);

  const tickets = jira.status === "fulfilled" ? jira.value : [];
  sources.jira = jira.status === "fulfilled" ? ok() : failed(jira.reason, "Couldn't read Jira.");
  sources.notes = notes.status === "fulfilled" ? ok() : failed(notes.reason, "Couldn't read your notes.");
  sources.tasks = tasks.status === "fulfilled" ? ok() : failed(tasks.reason, "Couldn't read your tasks.");

  let calendar: MeetingSignal[] = [];
  if (cal.status === "fulfilled") { calendar = cal.value.list; sources.calendar = cal.value.status; }
  else sources.calendar = failed(cal.reason, "Couldn't read your calendar.");

  let review: ReviewSignal = { commentsWritten: 0, assets: [] };
  try {
    review = await reviewActivity(session, w, new Set(tickets.map((t) => t.key)));
    sources.review = ok();
  } catch (e) {
    sources.review = failed(e, "Couldn't read review comments.");
  }

  return {
    window: w,
    tickets,
    review,
    tasksDone: tasks.status === "fulfilled" ? tasks.value : [],
    notes: notes.status === "fulfilled" ? notes.value : [],
    meetings: calendar,
    openAhead: ahead.status === "fulfilled" ? ahead.value : [],
    sources,
  };
}
