import { DEFAULT_FLOW } from "@/lib/brief/defaultFlow";
import { validateFlow, type Flow } from "@/lib/brief/flow";
import { updateDoc, readDoc } from "./doc";
import { AdminError, audit } from "./users";

export type FlowVersion = { version: number; updatedAt: string; updatedBy: string };
type FlowDoc = { flow: Flow | null; history: (FlowVersion & { flow: Flow })[] };
const empty = (): FlowDoc => ({ flow: null, history: [] });
const KEEP = 12;
const now = () => new Date().toISOString();

/** The published flow, or the built-in default until someone edits it. */
export async function readFlow(): Promise<{ flow: Flow; isDefault: boolean; history: FlowVersion[] }> {
  const { data } = await readDoc("brief-flow", empty);
  return {
    flow: data.flow ?? DEFAULT_FLOW,
    isDefault: !data.flow,
    history: data.history.map(({ version, updatedAt, updatedBy }) => ({ version, updatedAt, updatedBy })).reverse(),
  };
}

const current = (d: FlowDoc): Flow => d.flow ?? DEFAULT_FLOW;

function publish(d: FlowDoc, next: Flow, actor: string): Flow {
  const prev = current(d);
  const published: Flow = { ...next, version: prev.version + 1, updatedAt: now(), updatedBy: actor };
  d.history = [...d.history, { version: prev.version, updatedAt: prev.updatedAt ?? "", updatedBy: prev.updatedBy ?? "built-in", flow: prev }].slice(-KEEP);
  d.flow = published;
  return published;
}

/** Saves an edited flow. `baseVersion` is what the editor started from; if someone else saved since, refuse. */
export async function saveFlow(actor: string, flow: Flow, baseVersion: number): Promise<Flow> {
  const { errors } = validateFlow(flow);
  if (errors.length) throw new AdminError(400, errors[0] + (errors.length > 1 ? ` (and ${errors.length - 1} more)` : ""));
  const saved = await updateDoc("brief-flow", empty, (d) => {
    if (current(d).version !== baseVersion) throw new AdminError(409, "Someone else changed the questions while you were editing. Reload to see their version, then re-apply your changes.");
    return { data: d, result: publish(d, flow, actor) };
  });
  await audit({ actor, action: "flow.update", target: "brief questions", detail: `version ${saved.version}` });
  return saved;
}

export async function restoreFlow(actor: string, version: number): Promise<Flow> {
  const saved = await updateDoc("brief-flow", empty, (d) => {
    const old = d.history.find((h) => h.version === version);
    if (!old) throw new AdminError(404, "That version isn't available any more.");
    return { data: d, result: publish(d, old.flow, actor) };
  });
  await audit({ actor, action: "flow.restore", target: "brief questions", detail: `from version ${version}, now ${saved.version}` });
  return saved;
}

/** Back to the built-in questions. History is kept so it can be undone. */
export async function resetFlow(actor: string): Promise<Flow> {
  const saved = await updateDoc("brief-flow", empty, (d) => ({ data: d, result: publish(d, DEFAULT_FLOW, actor) }));
  await audit({ actor, action: "flow.reset", target: "brief questions", detail: `now version ${saved.version}` });
  return saved;
}
