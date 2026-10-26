import type { Flow, QNode } from "./flow";

const rid = () => Math.random().toString(36).slice(2, 8);
export const newNodeId = (flow: Flow) => { let id = `n_${rid()}`; while (flow.nodes.some((n) => n.id === id)) id = `n_${rid()}`; return id; };

/** An answer key not yet used in this flow, based on a starting word. */
export function uniqueField(flow: Flow, base = "question"): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9]+/, "") || "question";
  let f = slug, i = 2;
  while (flow.nodes.some((n) => n.field === f)) f = `${slug}_${i++}`;
  return f;
}

/** Inserts a new question after `afterId` on its default route (rules are untouched). */
export function addAfter(flow: Flow, afterId: string | null): { flow: Flow; id: string } {
  const id = newNodeId(flow);
  const node: QNode = { id, field: uniqueField(flow), label: "New question", prompt: "", qtype: "text", required: false, next: null };
  const nodes = structuredClone(flow.nodes);
  const after = nodes.find((n) => n.id === afterId);
  if (after) { node.next = after.next; after.next = id; }
  nodes.push(node);
  return { flow: { ...flow, nodes, start: nodes.length === 1 || !flow.start ? id : flow.start }, id };
}

/** Removes a question and re-links everything that pointed at it to whatever came next. */
export function deleteNode(flow: Flow, id: string): Flow {
  const gone = flow.nodes.find((n) => n.id === id);
  if (!gone) return flow;
  const heal = gone.next;
  const nodes = flow.nodes
    .filter((n) => n.id !== id)
    .map((n) => {
      const c = structuredClone(n);
      if (c.next === id) c.next = heal;
      // A rule can't point at "finish", so rules that led to the deleted question and have nowhere to go are dropped.
      c.branches = (c.branches ?? []).flatMap((b) => (b.goto === id ? (heal ? [{ ...b, goto: heal }] : []) : [b]));
      if (!c.branches.length) delete c.branches;
      return c;
    });
  const start = flow.start === id ? heal ?? nodes[0]?.id ?? "" : flow.start;
  return { ...flow, nodes, start };
}

/** Changes a question's answer key and updates every rule that checked the old key. */
export function renameField(flow: Flow, id: string, field: string): Flow {
  const old = flow.nodes.find((n) => n.id === id)?.field;
  if (old === undefined || old === field) return flow;
  return {
    ...flow,
    nodes: flow.nodes.map((n) => {
      const c = structuredClone(n);
      if (c.id === id) c.field = field;
      c.branches = c.branches?.map((b) => (b.when.field === old ? { ...b, when: { ...b.when, field } } : b));
      return c;
    }),
  };
}

export const updateNode = (flow: Flow, id: string, patch: Partial<QNode>): Flow => ({
  ...flow,
  nodes: flow.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
});

/** Moves one rule up or down (rules are checked in order; the first match wins). */
export function moveRule(flow: Flow, id: string, from: number, to: number): Flow {
  return updateNode(flow, id, {
    branches: (() => {
      const list = [...(flow.nodes.find((n) => n.id === id)?.branches ?? [])];
      if (to < 0 || to >= list.length) return list;
      const [x] = list.splice(from, 1);
      list.splice(to, 0, x);
      return list;
    })(),
  });
}
