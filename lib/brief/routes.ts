// A readable view of the question graph: for each request type, the questions that person is asked, in order,
// with the follow-up questions that appear only for certain answers nested under the question that triggers them.
import { OP_LABEL, byId, matches, optionsOf, type Answers, type Branch, type Flow, type QNode } from "./flow";

export type Fork = { label: string; items: RouteItem[] };
export type RouteItem = { node: QNode; forks: Fork[] };

/** "Yes", "Graphic design", "has an answer": what a rule is waiting for, in words. */
export function ruleLabel(flow: Flow, b: Branch): string {
  const q = flow.nodes.find((x) => x.field === b.when.field);
  const val = q ? optionsOf(q).find((o) => o.id === b.when.value)?.label ?? b.when.value : b.when.value;
  if (b.when.op === "notEmpty") return `${q?.label ?? b.when.field} has an answer`;
  if (b.when.op === "empty") return `${q?.label ?? b.when.field} is skipped`;
  const op = b.when.op === "equals" ? "is" : OP_LABEL[b.when.op];
  return `${q?.label ?? b.when.field} ${op} ${val ?? ""}`.trim();
}

/** The questions from `startId` along the usual route, until `stop` or the end. Follow-up questions hang off their parent as forks. */
function chain(flow: Flow, startId: string | null, typeField: string, stop: Set<string>, depth = 0): RouteItem[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let cur = byId(flow, startId);
  while (cur && !seen.has(cur.id) && !stop.has(cur.id) && ids.length < 80) {
    seen.add(cur.id); ids.push(cur.id);
    cur = byId(flow, cur.next);
  }
  const here = new Set([...stop, ...ids]);
  return ids.map((id) => {
    const node = byId(flow, id)!;
    const forks: Fork[] = depth > 3 ? [] : (node.branches ?? [])
      .filter((b) => b.when.field !== typeField)
      .map((b) => ({ label: ruleLabel(flow, b), items: chain(flow, b.goto, typeField, here, depth + 1) }))
      .filter((f) => f.items.length > 0);
    return { node, forks };
  });
}

/** Everything one request type is asked, start to finish. The branch on the request type is followed; other rules become forks. */
export function routeFor(flow: Flow, typeField: string, typeId: string): RouteItem[] {
  const answers: Answers = { [typeField]: typeId };
  const main: string[] = [];
  const seen = new Set<string>();
  let cur = byId(flow, flow.start);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id); main.push(cur.id);
    const hit = (cur.branches ?? []).find((b) => b.when.field === typeField && matches(b.when, answers));
    cur = byId(flow, hit ? hit.goto : cur.next);
  }
  const stopAfter = (i: number) => new Set(main.slice(0, i + 1));
  return main.map((id, i) => {
    const node = byId(flow, id)!;
    const forks = (node.branches ?? [])
      .filter((b) => b.when.field !== typeField)
      .map((b) => ({ label: ruleLabel(flow, b), items: chain(flow, b.goto, typeField, new Set([...main, ...stopAfter(i)])) }))
      .filter((f) => f.items.length > 0);
    return { node, forks };
  });
}

/** The question that decides the route (the one whose answer key is "type"), and the choices on it. */
export function typeChoices(flow: Flow): { node: QNode; options: { id: string; label: string }[] } | null {
  const node = flow.nodes.find((n) => n.field === "type" && (n.qtype === "choice"));
  return node ? { node, options: optionsOf(node).map((o) => ({ id: o.id, label: o.label })) } : null;
}

export const flatten = (items: RouteItem[]): QNode[] => items.flatMap((i) => [i.node, ...i.forks.flatMap((f) => flatten(f.items))]);

/** For each question, how many request types ask it. Used to tell "only this type" from "shared". */
export function sharedCounts(flow: Flow): Map<string, number> {
  const tc = typeChoices(flow);
  const counts = new Map<string, number>();
  if (!tc) return counts;
  for (const o of tc.options) for (const id of new Set(flatten(routeFor(flow, tc.node.field, o.id)).map((n) => n.id))) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}
