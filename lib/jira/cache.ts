import { JiraError } from "./client";

// A small per-server-instance cache in front of Jira reads. It does three things:
//  1. Repeat requests inside the TTL are served from memory instead of costing Jira quota.
//  2. Identical requests that arrive together share one Jira call.
//  3. If Jira answers 429 and we have an older copy, show that (marked stale) instead of an error.
// It is per person, so nobody ever sees someone else's data. Writes clear that person's entries.

type Entry = { at: number; value: unknown };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 400;
/** How old a copy may be when it's used because Jira is rate-limiting. */
export const STALE_OK_MS = 10 * 60_000;

export const now = { fn: () => Date.now() };

export async function cached<T>(user: string, key: string, ttlMs: number, load: () => Promise<T>): Promise<{ value: T; stale: boolean }> {
  const k = `${user}|${key}`;
  const hit = store.get(k);
  if (hit && now.fn() - hit.at < ttlMs) return { value: hit.value as T, stale: false };

  const pending = inflight.get(k) as Promise<T> | undefined;
  if (pending) return { value: await pending, stale: false };

  const run = (async () => {
    try {
      const value = await load();
      store.set(k, { at: now.fn(), value });
      if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
      return value;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, run);
  try {
    return { value: await run, stale: false };
  } catch (e) {
    if (e instanceof JiraError && e.status === 429 && hit && now.fn() - hit.at < STALE_OK_MS) return { value: hit.value as T, stale: true };
    throw e;
  }
}

/** Forget everything cached for one person, after something they changed. */
export function invalidateUser(user: string): void {
  for (const k of store.keys()) if (k.startsWith(`${user}|`)) store.delete(k);
}

export const _clearCache = () => { store.clear(); inflight.clear(); };
