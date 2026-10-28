import type { BriefSubmission } from "@/lib/types";
import { JiraError, jiraRequest, requestorField, type JiraAuth } from "./client";
import { HUB_LABEL, PROJECT_KEY } from "./map";

type Adf = { type: string; version?: number; content?: unknown[]; attrs?: Record<string, unknown>; text?: string };
const text = (t: string): Adf => ({ type: "text", text: t });
const para = (t: string): Adf => ({ type: "paragraph", content: t ? [text(t)] : [] });
const heading = (t: string): Adf => ({ type: "heading", attrs: { level: 3 }, content: [text(t)] });

/** The ticket description: who sent it from where, then each answer under its question, in the order asked. Line breaks are kept. */
export function briefToAdf(input: BriefSubmission, requesterName: string): Adf {
  const content: Adf[] = [para(`Submitted by ${requesterName} from the Brand Creative Hub.`)];
  for (const s of input.sections) {
    content.push(heading(s.label.slice(0, 200)));
    for (const line of s.value.split(/\r?\n/)) content.push(para(line));
  }
  return { type: "doc", version: 1, content };
}

const ID_RE = /^\d{1,10}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SECTIONS = 60;

/** Checks what the browser sent before anything reaches Jira. Throws a plain 400 message. */
export function validateBrief(input: unknown): BriefSubmission {
  const b = (input ?? {}) as Partial<BriefSubmission>;
  const title = String(b.title ?? "").trim();
  if (!title) throw new JiraError(400, "Give the brief a title.");
  if (title.length > 255) throw new JiraError(400, "That title is too long (255 characters at most).");
  if (!b.issueTypeId || !ID_RE.test(String(b.issueTypeId))) throw new JiraError(400, "Choose what kind of project this is.");
  if (b.deadline && !DATE_RE.test(String(b.deadline))) throw new JiraError(400, "That deadline doesn't look right.");
  const sections = Array.isArray(b.sections) ? b.sections.slice(0, MAX_SECTIONS).map((s) => ({ label: String(s?.label ?? "").slice(0, 200), value: String(s?.value ?? "").slice(0, 8000) })).filter((s) => s.label && s.value.trim()) : [];
  const stakeholders = Array.isArray(b.stakeholders) ? b.stakeholders.filter((p) => p?.id && p?.name).slice(0, 30).map((p) => ({ id: String(p.id), name: String(p.name), email: p.email ? String(p.email) : undefined })) : [];
  // Extra labels may only be simple words, so nothing odd reaches Jira.
  const labels = Array.isArray(b.labels) ? [...new Set(b.labels.map((l) => String(l).toLowerCase()).filter((l) => /^[a-z0-9][a-z0-9_-]{0,39}$/.test(l)))].slice(0, 3) : [];
  return { issueTypeId: String(b.issueTypeId), typeLabel: String(b.typeLabel ?? "").slice(0, 80), ...(labels.length ? { labels } : {}), title, deadline: b.deadline || undefined, stakeholders, sections };
}

/**
 * Creates the Jira ticket for a brief, as the signed-in person (so they are the reporter) and also in the Requestor field when
 * the site has one. Stakeholders go in the Cc field. Returns the new key. Needs the write:jira-work permission.
 */
export async function createBriefIssue(a: JiraAuth, input: BriefSubmission, who: { accountId: string; name: string }): Promise<string> {
  const requestor = await requestorField(a);
  const fields: Record<string, unknown> = {
    project: { key: PROJECT_KEY },
    issuetype: { id: input.issueTypeId },
    summary: input.title,
    description: briefToAdf(input, who.name),
    labels: [HUB_LABEL, ...(input.labels ?? []).filter((l) => l !== HUB_LABEL)],
    ...(input.deadline ? { duedate: input.deadline } : {}),
    ...(requestor && who.accountId ? { [requestor]: { accountId: who.accountId } } : {}),
    ...(input.stakeholders.length ? { customfield_10142: input.stakeholders.map((p) => ({ accountId: p.id })) } : {}),
  };
  const created = await jiraRequest<{ key: string }>(a, "/issue", { method: "POST", body: { fields } });
  return String(created.key);
}
