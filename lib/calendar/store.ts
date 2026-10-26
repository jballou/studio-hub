import { isJira } from "@/lib/data/mode";
import { demoJiraItems, demoLaunchCsv, demoSocialCsv } from "./demo";
import { ingestSheet } from "./sheet";
import type { CalendarSource, SourceResult } from "./types";

const KEY = "calendar-sources-v1";

const BUILTIN: CalendarSource[] = [
  { id: "demo-social", name: "Social plan (sample sheet)", kind: "sheet", defaultType: "social", builtin: true },
  { id: "demo-launches", name: "PR, events & launches (sample sheet)", kind: "sheet", defaultType: "other", builtin: true },
  { id: "jira-mktgcrtv", name: "MKTGCRTV (Jira, sample)", kind: "jira", defaultType: "other", jql: "project = MKTGCRTV AND duedate is not EMPTY", dateField: "Due date", builtin: true },
];

const JIRA_SOURCE: CalendarSource = {
  id: "jira-mktgcrtv", name: "MKTGCRTV (Jira)", kind: "jira", defaultType: "other", builtin: true,
  jql: "project = MKTGCRTV AND duedate is not EMPTY AND statusCategory != Done ORDER BY duedate ASC", dateField: "duedate",
};

export function loadSources(): CalendarSource[] {
  let saved: CalendarSource[] = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { /* ignore corrupt data */ }
  return [...(isJira ? [JIRA_SOURCE] : BUILTIN), ...saved];
}

export function saveUserSources(all: CalendarSource[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(all.filter((s) => !s.builtin))); return true; } catch { return false; }
}

export async function fetchSheetCsv(url: string): Promise<string> {
  const res = await fetch(`/api/sheet-csv?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Couldn't load the sheet." }));
    throw new Error(body.error ?? "Couldn't load the sheet.");
  }
  return res.text();
}

export async function loadSource(src: CalendarSource): Promise<SourceResult> {
  const fail = (error: string): SourceResult => ({ sourceId: src.id, items: [], warnings: [], error, loadedAt: new Date().toISOString() });
  try {
    if (src.id === "demo-social") return ingestSheet(demoSocialCsv(), src);
    if (src.id === "demo-launches") return ingestSheet(demoLaunchCsv(), src);
    if (src.kind === "jira" && isJira) {
      const qs = new URLSearchParams({ jql: src.jql ?? "", dateField: src.dateField ?? "duedate", sourceId: src.id, sourceName: src.name });
      const res = await fetch(`/api/jira/calendar?${qs}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return fail("Sign in again to load Jira.");
      if (!res.ok) return fail(body.error ?? `Jira request failed (${res.status}).`);
      return { sourceId: src.id, items: body.items, warnings: body.skipped ? [`${body.skipped} tickets skipped: no date.`] : [], loadedAt: new Date().toISOString() };
    }
    if (src.kind === "jira") {
      // Real adapter: query Jira with the signed-in user's token using src.jql and src.dateField.
      return { sourceId: src.id, items: src.id === "jira-mktgcrtv" ? demoJiraItems() : [], warnings: ["Sample data. Live Jira sync needs Atlassian sign-in."], loadedAt: new Date().toISOString() };
    }
    const text = src.csv ?? (src.url ? await fetchSheetCsv(src.url) : "");
    if (!text) return fail("No sheet link or CSV on this source.");
    return ingestSheet(text, src);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't load this source.");
  }
}
