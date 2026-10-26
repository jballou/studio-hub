import type { Block, Person } from "@/lib/types";
import { readDoc, updateDoc } from "./doc";
import { AdminError, audit } from "./users";

// Jira only knows a ticket's status is "Blocked"; the person holding it up lives here. Resolved blocks are kept
// (not deleted) so we can later report how long work sits blocked and with whom.
export type { Block };

type BlocksDoc = { blocks: Block[] };
const empty = (): BlocksDoc => ({ blocks: [] });
const now = () => new Date().toISOString();
const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

let cache: { at: number; data: BlocksDoc } | null = null;
const TTL_MS = 8_000;

async function doc(): Promise<BlocksDoc> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const { data } = await readDoc("blocks", empty);
  cache = { at: Date.now(), data };
  return data;
}

export async function activeBlocks(keys?: string[]): Promise<Block[]> {
  const d = await doc();
  return d.blocks.filter((b) => b.status === "active" && (!keys || keys.includes(b.key)));
}

export async function blocksHeldBy(accountId: string): Promise<Block[]> {
  return (await activeBlocks()).filter((b) => b.blockedBy.id === accountId);
}

export async function createBlock(actor: string, input: { key: string; blockedBy: Person; reason: string }): Promise<Block> {
  const key = input.key.trim().toUpperCase();
  const reason = input.reason.trim().slice(0, 500);
  if (!KEY_RE.test(key)) throw new AdminError(400, "That doesn't look like a Jira key.");
  if (!input.blockedBy?.id || !input.blockedBy?.name) throw new AdminError(400, "Choose who it's blocked by.");
  if (!reason) throw new AdminError(400, "Add a short reason so they know what's needed.");
  const blockedBy: Person = { id: input.blockedBy.id, name: input.blockedBy.name, email: input.blockedBy.email };

  const out = await updateDoc("blocks", empty, (d) => {
    const existing = d.blocks.find((b) => b.key === key && b.status === "active");
    if (existing) {
      // Re-pointing an active block keeps its original start time, so "blocked for N days" stays honest.
      existing.blockedBy = blockedBy;
      existing.reason = reason;
      return { data: d, result: { block: existing, reassigned: true } };
    }
    const block: Block = { key, blockedBy, reason, since: now(), setBy: actor, status: "active" };
    d.blocks.push(block);
    return { data: d, result: { block, reassigned: false } };
  });
  cache = null;
  await audit({ actor, action: out.reassigned ? "block.reassign" : "block.create", target: key, detail: `blocked by ${blockedBy.name}` });
  return out.block;
}

export async function resolveBlock(
  actor: { email: string; accountId: string; canManage: boolean },
  keyRaw: string,
  note: string,
): Promise<Block> {
  const key = keyRaw.trim().toUpperCase();
  const out = await updateDoc("blocks", empty, (d) => {
    const b = d.blocks.find((x) => x.key === key && x.status === "active");
    if (!b) throw new AdminError(404, "That ticket isn't marked as blocked.");
    // The person holding it up can clear it; so can the creative team and admins.
    if (b.blockedBy.id !== actor.accountId && !actor.canManage) throw new AdminError(403, "Only the person it's blocked by, or the creative team, can clear this.");
    b.status = "resolved";
    b.resolvedAt = now();
    b.resolvedBy = actor.email;
    b.note = note.trim().slice(0, 500) || undefined;
    return { data: d, result: b };
  });
  cache = null;
  await audit({ actor: actor.email, action: "block.resolve", target: key, detail: note.trim().slice(0, 120) || undefined });
  return out;
}
