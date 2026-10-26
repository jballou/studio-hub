import type { Block, JiraSync, Person, Project } from "@/lib/types";
import { isJira } from "./mode";

export type MyBlock = Block & { project: Project | null };

export interface BlocksRepo {
  /** Active blocks for these tickets (to show "blocked by" tags). */
  list(keys: string[]): Promise<Block[]>;
  /** Tickets waiting on the signed-in person. */
  mine(): Promise<MyBlock[]>;
  /** The block is always saved; `jira` says whether the ticket's status followed (absent in demo mode). */
  block(key: string, blockedBy: Person, reason: string): Promise<{ block: Block; jira?: JiraSync }>;
  resolve(key: string, note: string): Promise<{ jira?: JiraSync }>;
}

const changed = () => typeof window !== "undefined" && window.dispatchEvent(new Event("blocks-changed"));

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body as T;
}

const jiraBlocks: BlocksRepo = {
  async list(keys) {
    if (!keys.length) return [];
    return (await call<{ blocks: Block[] }>(`/api/blocks?keys=${encodeURIComponent(keys.slice(0, 100).join(","))}`)).blocks;
  },
  async mine() {
    return (await call<{ blocks: MyBlock[] }>("/api/blocks?mine=1")).blocks;
  },
  async block(key, blockedBy, reason) {
    const out = await call<{ block: Block; jira: JiraSync }>("/api/blocks", { method: "POST", body: JSON.stringify({ key, blockedBy, reason }) });
    changed();
    return out;
  },
  async resolve(key, note) {
    const out = await call<{ jira: JiraSync }>(`/api/blocks/${encodeURIComponent(key)}/resolve`, { method: "POST", body: JSON.stringify({ note }) });
    changed();
    return { jira: out.jira };
  },
};

// Demo mode keeps blocks in the browser so the feature can be tried without sign-in.
const LS = "blocks-demo-v1";
const DEMO_ME = "u-avery";
function readLocal(): Block[] {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable */ }
  const day = 864e5;
  return [
    { key: "MKTGCRTV-102", blockedBy: { id: "u-riley", name: "Riley Brooks" }, reason: "Waiting on legal sign-off for the script.", since: new Date(Date.now() - 3 * day).toISOString(), setBy: "avery.chen@example.com", status: "active" },
    { key: "MKTGCRTV-103", blockedBy: { id: DEMO_ME, name: "Avery Chen" }, reason: "Need the final logo files from Brand.", since: new Date(Date.now() - 1 * day).toISOString(), setBy: "sam.okafor@example.com", status: "active" },
  ];
}
const writeLocal = (b: Block[]) => { try { localStorage.setItem(LS, JSON.stringify(b)); } catch { /* ignore */ } };

const demoBlocks: BlocksRepo = {
  async list(keys) { return readLocal().filter((b) => b.status === "active" && keys.includes(b.key)); },
  async mine() {
    const { projectsRepo } = await import("./index");
    const projects = await projectsRepo.listProjects(DEMO_ME);
    return readLocal().filter((b) => b.status === "active" && b.blockedBy.id === DEMO_ME).map((b) => ({ ...b, project: projects.find((p) => p.jiraKey === b.key) ?? null }));
  },
  async block(key, blockedBy, reason) {
    if (!reason.trim()) throw new Error("Add a short reason so they know what's needed.");
    const all = readLocal();
    const existing = all.find((b) => b.key === key && b.status === "active");
    const block: Block = existing ?? { key, blockedBy, reason, since: new Date().toISOString(), setBy: "you", status: "active" };
    if (existing) { existing.blockedBy = blockedBy; existing.reason = reason; }
    else all.push(block);
    writeLocal(all);
    changed();
    return { block };
  },
  async resolve(key, note) {
    const all = readLocal();
    const b = all.find((x) => x.key === key && x.status === "active");
    if (!b) throw new Error("That ticket isn't marked as blocked.");
    b.status = "resolved"; b.resolvedAt = new Date().toISOString(); b.note = note || undefined;
    writeLocal(all);
    changed();
    return {};
  },
};

export const blocksRepo: BlocksRepo = isJira ? jiraBlocks : demoBlocks;
