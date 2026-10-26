import type { DayEvent } from "@/lib/myday/plan";
import { isJira } from "./mode";

export type GoogleStatus = { configured: boolean; connected: boolean; googleEmail?: string; broken?: boolean };

export interface GoogleRepo {
  status(): Promise<GoogleStatus>;
  /** Events between two instants. Rejects with `code` "not-connected" | "reconnect" | "not-configured" when they can't be read. */
  events(fromIso: string, toIso: string): Promise<DayEvent[]>;
  disconnect(): Promise<void>;
}

export class GoogleUnavailable extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

const jiraGoogle: GoogleRepo = {
  async status() {
    const res = await fetch("/api/google/status", { cache: "no-store" });
    if (!res.ok) return { configured: false, connected: false };
    return res.json();
  },
  async events(from, to) {
    const res = await fetch(`/api/google/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new GoogleUnavailable(body.error ?? "Couldn't load your calendar.", body.code);
    return body.events;
  },
  async disconnect() {
    await fetch("/api/google/disconnect", { method: "POST" });
  },
};

// Demo mode: a made-up day so the page can be tried without Google. Clearly labelled in the UI.
const at = (h: number, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const demoGoogle: GoogleRepo = {
  async status() { return { configured: true, connected: true, googleEmail: "demo@example.com" }; },
  async events(from, to) {
    const all: DayEvent[] = [
      { id: "d1", title: "Brand weekly sync", start: at(10), end: at(10, 30), allDay: false },
      { id: "d2", title: "Spring campaign review", start: at(13), end: at(14), allDay: false },
      { id: "d3", title: "1:1 with Sam", start: at(15, 30), end: at(16), allDay: false },
    ];
    return all.filter((e) => e.start < to && e.end > from);
  },
  async disconnect() {},
};

export const googleRepo: GoogleRepo = isJira ? jiraGoogle : demoGoogle;
