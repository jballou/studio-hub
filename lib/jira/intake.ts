import { addIssueCommentMentioning, JiraError, linkAsDuplicate, listTargetStatuses, searchIssues, transitionInfo, transitionToStatus, INTAKE_FIELDS, type JiraAuth } from "./client";
import { PROJECT_KEY, toProject } from "./map";
import type { IntakeAction, IntakeInput, IntakeResult, Project } from "@/lib/types";

/** Waiting to be picked up, but not parked on purpose. Backlog and On Hold stay out of the queue. */
const PARKED = new Set(["backlog", "on hold"]);

/** Open, unassigned tickets, oldest first, as the creative team triages them. Filtering by status name happens here so a status this site doesn't have can't break the search. */
export async function loadIntake(a: JiraAuth): Promise<Project[]> {
  const jql = `project = ${PROJECT_KEY} AND assignee is EMPTY AND statusCategory != Done ORDER BY created ASC`;
  const issues = await searchIssues(a, jql, INTAKE_FIELDS, 100);
  return issues.filter((i) => !PARKED.has(i.fields.status.name.toLowerCase())).map(toProject);
}

// The workflow's wording differs between sites ("Need more info", "Won't Do"), so each action accepts any of a few names.
const TARGETS: Record<IntakeAction, string[]> = {
  info: ["need more info", "needs more info", "need info", "more info needed", "waiting for info", "waiting on requester"],
  wontdo: ["won't do", "won’t do", "wont do", "declined", "rejected", "closed - won't do"],
  duplicate: ["duplicate", "duplicated", "closed - duplicate"],
};
const LABEL: Record<IntakeAction, string> = { info: "Need more info", wontdo: "Won't do", duplicate: "Duplicate" };
const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * Sends a ticket back for more information, or closes it as won't do or a duplicate. The status moves first; the
 * explaining comment (and, for a duplicate, the link) follow. If one of those fails the move still stands and the
 * result says what didn't go through.
 */
export async function runIntakeAction(a: JiraAuth, key: string, input: IntakeInput): Promise<IntakeResult> {
  if (!KEY_RE.test(key)) throw new JiraError(400, "That doesn't look like a Jira key.");
  const note = (input.note ?? "").trim().slice(0, 1500);
  const dupe = (input.duplicateOf ?? "").trim().toUpperCase();
  if (input.action === "info" && note.length < 3) throw new JiraError(400, "Say what you need to know, so they can answer.");
  if (input.action === "duplicate" && !KEY_RE.test(dupe)) throw new JiraError(400, "Enter the ticket this repeats, like MKTGCRTV-123.");
  if (input.action === "duplicate" && dupe === key) throw new JiraError(400, "A ticket can't be a duplicate of itself.");

  const [issue] = await searchIssues(a, `key = ${key}`, INTAKE_FIELDS, 1);
  if (!issue) throw new JiraError(404, "Ticket not found.");
  const p = toProject(issue);
  if (p.assigneeId) throw new JiraError(409, `${key} has already been assigned${p.assigneeName ? ` to ${p.assigneeName}` : ""}. Refresh the queue.`);

  const info = await transitionInfo(a, key);
  const offered = await listTargetStatuses(a, key, info);
  const target = offered.find((o) => TARGETS[input.action].includes(o.name.toLowerCase()));
  if (!target) {
    const names = offered.map((o) => o.name).join(", ");
    throw new JiraError(409, `Jira doesn't offer a “${LABEL[input.action]}” step for ${key} from ${info.current}.${names ? ` It offers: ${names}.` : ""}`);
  }
  const moved = await transitionToStatus(a, key, target.name, info);
  if (moved === "no-transition") throw new JiraError(409, `Jira wouldn't move ${key} to ${target.name}.`);

  const notes: string[] = [];
  const requester = p.requesterId ? { id: p.requesterId, name: p.requesterName ?? "requester" } : null;
  const lines =
    input.action === "info" ? ["we need a bit more information before we can start on this.", note, "Reply here and it comes back to the team's queue."]
    : input.action === "wontdo" ? ["Closing this as won't do.", ...(note ? [note] : [])]
    : [`Closing this as a duplicate of ${dupe}.`, ...(note ? [note] : [])];
  try {
    await addIssueCommentMentioning(a, key, input.action === "info" ? requester : null, lines);
  } catch {
    notes.push(input.action === "info" ? "The status moved, but the comment explaining why couldn't be posted. Add it in Jira so they know what to answer." : "The status moved, but the comment couldn't be posted.");
  }
  if (input.action === "duplicate") {
    try { await linkAsDuplicate(a, key, dupe); } catch { notes.push(`The status moved, but Jira wouldn't link it to ${dupe}. Check that ticket exists.`); }
  }
  return { ok: true, status: target.name, notes };
}
