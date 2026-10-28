import type { AppNotification } from "@/lib/types";
import { isJira } from "./mode";

export type Inbox = { items: AppNotification[]; unread: number };

export interface NotificationsRepo {
  list(): Promise<Inbox>;
  /** Marks these read, or everything when no ids are given. */
  markRead(ids?: string[]): Promise<Inbox>;
}

const changed = () => typeof window !== "undefined" && window.dispatchEvent(new Event("notifications-changed"));

async function call(init?: RequestInit): Promise<Inbox> {
  const res = await fetch("/api/notifications", { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body as Inbox;
}

const real: NotificationsRepo = {
  list: () => call(),
  async markRead(ids) {
    const out = await call({ method: "POST", body: JSON.stringify({ ids }) });
    changed();
    return out;
  },
};

// Demo: a couple of examples so the bell has something to show. Resets on reload like the rest of the demo.
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
let demo: AppNotification[] = [
  { id: "n1", kind: "review-request", key: "review-request:a-video", assetId: "a-video", assetName: "Product teaser (15s)", projectKey: "MKTGCRTV-102", fromName: "Riley Brooks", createdAt: ago(25), readAt: null },
  { id: "n2", kind: "new-version", key: "new-version:a-ad", assetId: "a-ad", assetName: "Spring campaign: social ad", projectKey: "MKTGCRTV-101", fromName: "Sam Okafor", createdAt: ago(180), readAt: null },
  { id: "n3", kind: "approved", key: "approved:a-pdf", assetId: "a-pdf", assetName: "Brand one-pager", projectKey: "MKTGCRTV-103", fromName: "Jordan Patel", createdAt: ago(60 * 30), readAt: ago(60 * 20) },
];
const snapshot = (): Inbox => ({ items: structuredClone(demo), unread: demo.filter((n) => !n.readAt).length });
const mock: NotificationsRepo = {
  list: async () => snapshot(),
  async markRead(ids) {
    const at = new Date().toISOString();
    demo = demo.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: at } : n));
    changed();
    return snapshot();
  },
};

export const notificationsRepo: NotificationsRepo = isJira ? real : mock;
