// The brief wizard is driven by data: a graph of questions with branching rules. The wizard, the
// flow-chart editor and the saved version all share these types so they can never drift apart.
import type { Person } from "@/lib/types";

export type QType = "text" | "longtext" | "choice" | "multichoice" | "yesno" | "date" | "people" | "link";

export type Option = {
  id: string;
  label: string;
  /** For the question whose field is "type": the Jira issue type to create. */
  jiraIssueTypeId?: string;
  /** For the "type" question: an extra Jira label added to the ticket (lets a kind of request be found and counted). */
  jiraLabel?: string;
};

export type Op = "equals" | "notEquals" | "includes" | "notEmpty" | "empty";
export type Cond = { field: string; op: Op; value?: string };
export type Branch = { when: Cond; goto: string };

export type QNode = {
  id: string;
  /** Key the answer is stored under. Reserved: type, title, deadline, stakeholders. */
  field: string;
  /** Short heading used in the summary and the Jira description, e.g. "Problem statement". */
  label: string;
  /** What the assistant asks. May reference earlier answers as {{field}}. */
  prompt: string;
  help?: string;
  placeholder?: string;
  qtype: QType;
  options?: Option[];
  required: boolean;
  /** Where to go if no branch matches. null means the brief is complete. */
  next: string | null;
  branches?: Branch[];
};

export type Flow = {
  version: number;
  start: string;
  nodes: QNode[];
  updatedAt?: string;
  updatedBy?: string;
};

export type AnswerValue = string | string[] | Person[];
export type Answers = Record<string, AnswerValue>;

export const RESERVED_FIELDS = ["type", "title", "deadline", "stakeholders"] as const;
export const QTYPE_LABEL: Record<QType, string> = {
  text: "Short answer", longtext: "Long answer", choice: "Pick one", multichoice: "Pick several",
  yesno: "Yes / No", date: "Date", people: "People", link: "Link",
};
export const OP_LABEL: Record<Op, string> = {
  equals: "is", notEquals: "is not", includes: "includes", notEmpty: "has an answer", empty: "is empty / skipped",
};
export const YESNO: Option[] = [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }];

export const optionsOf = (n: QNode): Option[] => (n.qtype === "yesno" ? YESNO : n.options ?? []);
export const byId = (flow: Flow, id: string | null | undefined) => flow.nodes.find((n) => n.id === id);

/** Answers reduced to a list of plain strings, so conditions work the same for every question type. */
function asList(v: AnswerValue | undefined): string[] {
  if (v === undefined) return [];
  if (typeof v === "string") return v.trim() ? [v] : [];
  return v.map((x) => (typeof x === "string" ? x : x.id)).filter(Boolean);
}

export function matches(c: Cond, answers: Answers): boolean {
  const list = asList(answers[c.field]);
  switch (c.op) {
    case "equals": return list.length === 1 && list[0] === c.value;
    case "notEquals": return !(list.length === 1 && list[0] === c.value);
    case "includes": return list.includes(c.value ?? "");
    case "notEmpty": return list.length > 0;
    case "empty": return list.length === 0;
  }
}

/** First matching branch wins; otherwise the default next. */
export function nextOf(node: QNode, answers: Answers): string | null {
  for (const b of node.branches ?? []) if (matches(b.when, answers)) return b.goto;
  return node.next;
}

export const isAnswered = (answers: Answers, node: QNode) => answers[node.field] !== undefined;

export type Walk = {
  /** Questions already answered, in order. */
  path: QNode[];
  /** The question to ask now, or null when the brief is complete. */
  current: QNode | null;
};

/**
 * Follows the answers through the graph. Because the path is derived (not stored), changing an earlier
 * answer automatically re-routes everything after it; answers on abandoned branches are simply ignored.
 */
export function walk(flow: Flow, answers: Answers): Walk {
  const path: QNode[] = [];
  const seen = new Set<string>();
  let cur: QNode | undefined = byId(flow, flow.start);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (!isAnswered(answers, cur)) return { path, current: cur };
    path.push(cur);
    cur = byId(flow, nextOf(cur, answers));
  }
  return { path, current: null };
}

/** Human-readable form of an answer, for summaries and {{placeholders}}. */
export function display(node: QNode, v: AnswerValue | undefined): string {
  if (v === undefined) return "";
  if (Array.isArray(v)) {
    if (node.qtype === "people") return (v as Person[]).map((p) => p.name).join(", ");
    return (v as string[]).map((id) => optionsOf(node).find((o) => o.id === id)?.label ?? id).join(", ");
  }
  if (node.qtype === "choice" || node.qtype === "yesno") return optionsOf(node).find((o) => o.id === v)?.label ?? v;
  return v;
}

export function interpolate(text: string, flow: Flow, answers: Answers): string {
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, field: string) => {
    const n = flow.nodes.find((x) => x.field === field);
    const out = n ? display(n, answers[field]) : "";
    return out || "this";
  });
}

/** True when every possible answer is claimed by a rule, so the "usually ask" question can never be reached from here. */
export function defaultIsDead(n: QNode): boolean {
  if (!n.required || (n.qtype !== "choice" && n.qtype !== "yesno")) return false;
  const claimed = new Set((n.branches ?? []).filter((b) => b.when.field === n.field && b.when.op === "equals").map((b) => b.when.value));
  const opts = optionsOf(n);
  return opts.length > 0 && opts.every((o) => claimed.has(o.id));
}

export type Problems = { errors: string[]; warnings: string[] };

/** Checks a flow is safe to publish. Errors block saving; warnings are advice. */
export function validateFlow(flow: Flow): Problems {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const fields = new Map<string, string>();
  const name = (n: QNode) => `“${n.label || n.prompt.slice(0, 30) || n.id}”`;

  for (const n of flow.nodes) {
    if (ids.has(n.id)) errors.push(`Two questions share the id ${n.id}.`);
    ids.add(n.id);
    if (!n.prompt.trim()) errors.push(`A question has no text (${n.id}).`);
    if (!/^[a-z][a-z0-9_]*$/.test(n.field)) errors.push(`${name(n)}: the answer key must be lowercase letters, numbers and underscores.`);
    else if (fields.has(n.field)) errors.push(`${name(n)} and ${fields.get(n.field)} use the same answer key “${n.field}”.`);
    else fields.set(n.field, name(n));
    if ((n.qtype === "choice" || n.qtype === "multichoice") && (n.options?.length ?? 0) < 2) errors.push(`${name(n)} needs at least two options.`);
    const optIds = (n.options ?? []).map((o) => o.id);
    if (new Set(optIds).size !== optIds.length) errors.push(`${name(n)} has duplicate options.`);
    if ((n.options ?? []).some((o) => !o.label.trim())) errors.push(`${name(n)} has an option with no label.`);
  }

  if (!byId(flow, flow.start)) errors.push("The flow has no starting question.");
  const missing = (to: string | null | undefined) => !!to && !ids.has(to);
  for (const n of flow.nodes) {
    if (missing(n.next)) errors.push(`${name(n)} points to a question that no longer exists.`);
    for (const b of n.branches ?? []) {
      if (missing(b.goto)) errors.push(`${name(n)} has a rule pointing to a question that no longer exists.`);
      if (!fields.has(b.when.field)) errors.push(`${name(n)} has a rule that checks “${b.when.field}”, which isn't a question in this flow.`);
      if ((b.when.op === "equals" || b.when.op === "notEquals" || b.when.op === "includes") && !b.when.value) errors.push(`${name(n)} has a rule with no value to compare.`);
      const target = flow.nodes.find((x) => x.field === b.when.field);
      if (target && b.when.value && ["choice", "multichoice", "yesno"].includes(target.qtype) && !optionsOf(target).some((o) => o.id === b.when.value)) {
        errors.push(`${name(n)} has a rule that compares to an option that no longer exists on ${name(target)}.`);
      }
    }
  }

  // Loops would trap the wizard, so they can't be saved.
  const state = new Map<string, 1 | 2>();
  const dfs = (id: string): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    const n = byId(flow, id);
    if (n) for (const to of [n.next, ...(n.branches ?? []).map((b) => b.goto)]) if (to && ids.has(to) && dfs(to)) return true;
    state.set(id, 2);
    return false;
  };
  if (byId(flow, flow.start) && dfs(flow.start)) errors.push("The flow loops back on itself. Each path has to end.");

  // Reachability and advice.
  const reach = new Set<string>();
  const visit = (id: string | null) => {
    if (!id || reach.has(id) || !ids.has(id)) return;
    reach.add(id);
    const n = byId(flow, id)!;
    // A required pick-one question with a rule for every option never falls through to its "usually ask" question.
    if (!defaultIsDead(n)) visit(n.next);
    (n.branches ?? []).forEach((b) => visit(b.goto));
  };
  visit(flow.start);
  for (const n of flow.nodes) {
    if (reach.has(n.id)) continue;
    const behindDead = flow.nodes.find((m) => m.next === n.id && defaultIsDead(m));
    warnings.push(behindDead
      ? `${name(n)} can't be reached: ${name(behindDead)} has a rule for every answer, so its “usually ask” question is never used. Point a rule at ${name(n)} instead.`
      : `${name(n)} can't be reached from the start, so nobody will see it.`);
  }
  for (const f of ["type", "title"]) if (!fields.has(f) && flow.nodes.length) warnings.push(`There's no question with the answer key “${f}”. Tickets need ${f === "type" ? "a request type" : "a title"}.`);
  return { errors, warnings };
}

/** Layered left-to-right layout for the flow chart. Longest path from the start decides the column. */
export function layout(flow: Flow, colW = 300, rowH = 104): { pos: Record<string, { x: number; y: number }>; width: number; height: number } {
  const level = new Map<string, number>();
  const order: string[] = [];
  const succ = (n: QNode) => [...new Set([n.next, ...(n.branches ?? []).map((b) => b.goto)].filter((x): x is string => !!x && !!byId(flow, x)))];

  const visiting = new Set<string>();
  const place = (id: string, lv: number) => {
    if (visiting.has(id)) return; // loop guard; validateFlow reports it
    if ((level.get(id) ?? -1) >= lv) return;
    if (!level.has(id)) order.push(id);
    level.set(id, lv);
    const n = byId(flow, id)!;
    visiting.add(id);
    succ(n).forEach((to) => place(to, lv + 1));
    visiting.delete(id);
  };
  if (byId(flow, flow.start)) place(flow.start, 0);
  // Unreachable nodes go in a column after the main flow so the editor can still show them.
  const maxLv = Math.max(-1, ...level.values());
  flow.nodes.filter((n) => !level.has(n.id)).forEach((n, i) => { level.set(n.id, maxLv + 1); order.push(n.id); void i; });

  const cols = new Map<number, string[]>();
  order.forEach((id) => { const l = level.get(id)!; cols.set(l, [...(cols.get(l) ?? []), id]); });
  const pos: Record<string, { x: number; y: number }> = {};
  let rows = 0;
  cols.forEach((ids, l) => { rows = Math.max(rows, ids.length); ids.forEach((id, i) => { pos[id] = { x: l * colW, y: i * rowH }; }); });
  return { pos, width: (Math.max(0, ...cols.keys()) + 1) * colW, height: Math.max(1, rows) * rowH };
}
