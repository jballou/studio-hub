import { DEFAULT_FLOW } from "@/lib/brief/defaultFlow";
import { validateFlow, type Flow } from "@/lib/brief/flow";
import { isJira } from "./mode";

export type FlowVersion = { version: number; updatedAt: string; updatedBy: string };
export type FlowState = { flow: Flow; isDefault: boolean; history: FlowVersion[] };

export interface FlowRepo {
  get(): Promise<FlowState>;
  /** Publish an edit. `baseVersion` is the version the editor started from, so concurrent edits are caught. */
  save(flow: Flow, baseVersion: number): Promise<Flow>;
  restore(version: number): Promise<Flow>;
  reset(): Promise<Flow>;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body as T;
}

const jiraFlow: FlowRepo = {
  get: () => call<FlowState>("/api/brief-flow"),
  save: async (flow, baseVersion) => (await call<{ flow: Flow }>("/api/brief-flow", { method: "PUT", body: JSON.stringify({ flow, baseVersion }) })).flow,
  restore: async (version) => (await call<{ flow: Flow }>("/api/brief-flow/restore", { method: "POST", body: JSON.stringify({ version }) })).flow,
  reset: async () => (await call<{ flow: Flow }>("/api/brief-flow/reset", { method: "POST" })).flow,
};

// Demo mode keeps the flow in this browser so the editor can be tried without signing in.
const LS = "brief-flow-demo-v1";
type Stored = { flow: Flow | null; history: (FlowVersion & { flow: Flow })[] };
const read = (): Stored => { try { return JSON.parse(localStorage.getItem(LS) ?? "") as Stored; } catch { return { flow: null, history: [] }; } };
const write = (s: Stored) => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* storage unavailable */ } };

function publish(s: Stored, next: Flow): Flow {
  const prev = s.flow ?? DEFAULT_FLOW;
  const flow = { ...next, version: prev.version + 1, updatedAt: new Date().toISOString(), updatedBy: "you (demo)" };
  s.history = [...s.history, { version: prev.version, updatedAt: prev.updatedAt ?? "", updatedBy: prev.updatedBy ?? "built-in", flow: prev }].slice(-12);
  s.flow = flow;
  write(s);
  return flow;
}

const demoFlow: FlowRepo = {
  async get() {
    const s = read();
    return { flow: s.flow ?? DEFAULT_FLOW, isDefault: !s.flow, history: s.history.map(({ version, updatedAt, updatedBy }) => ({ version, updatedAt, updatedBy })).reverse() };
  },
  async save(flow, baseVersion) {
    const s = read();
    const { errors } = validateFlow(flow);
    if (errors.length) throw new Error(errors[0]);
    if ((s.flow ?? DEFAULT_FLOW).version !== baseVersion) throw new Error("The questions changed while you were editing. Reload to see the latest.");
    return publish(s, flow);
  },
  async restore(version) {
    const s = read();
    const old = s.history.find((h) => h.version === version);
    if (!old) throw new Error("That version isn't available any more.");
    return publish(s, old.flow);
  },
  async reset() { return publish(read(), DEFAULT_FLOW); },
};

export const flowRepo: FlowRepo = isJira ? jiraFlow : demoFlow;
