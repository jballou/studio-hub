// In-app notifications, one small document per person so a busy day for one person never blocks another.
import type { AppNotification } from "@/lib/types";
import { readDoc, updateDoc } from "./doc";

type Doc = { items: AppNotification[] };
const empty = (): Doc => ({ items: [] });
const KEEP = 100;
const name = (accountId: string) => `notifications-${accountId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80)}`;

export type NewNotification = Omit<AppNotification, "id" | "createdAt" | "readAt">;

/**
 * Adds a notification for each person. A repeat of the same `key` that they haven't read yet is folded into
 * the existing one (the batch count goes up and it moves to the top) so a 5-item batch is one line, not five.
 */
export async function notify(recipientIds: string[], n: NewNotification): Promise<void> {
  const ids = [...new Set(recipientIds.filter(Boolean))];
  await Promise.all(ids.map((id) =>
    updateDoc(name(id), empty, (d) => {
      const at = new Date().toISOString();
      const existing = d.items.find((x) => x.key === n.key && !x.readAt);
      if (existing) {
        existing.count = (existing.count ?? 1) + (n.count ?? 1);
        existing.createdAt = at;
        d.items = [existing, ...d.items.filter((x) => x !== existing)];
      } else {
        d.items = [{ ...n, id: crypto.randomUUID(), createdAt: at, readAt: null }, ...d.items].slice(0, KEEP);
      }
      return { data: d, result: undefined };
    }).catch(() => undefined), // a missed notification must never fail the action that caused it
  ));
}

export async function listNotifications(accountId: string, limit = 30): Promise<{ items: AppNotification[]; unread: number }> {
  const { data } = await readDoc(name(accountId), empty);
  return { items: data.items.slice(0, limit), unread: data.items.filter((x) => !x.readAt).length };
}

/** Marks the given ones read, or all when `ids` is omitted. */
export async function markRead(accountId: string, ids?: string[]): Promise<void> {
  await updateDoc(name(accountId), empty, (d) => {
    const at = new Date().toISOString();
    for (const x of d.items) if (!x.readAt && (!ids || ids.includes(x.id))) x.readAt = at;
    return { data: d, result: undefined };
  });
}
