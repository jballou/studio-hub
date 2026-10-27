import { createHash } from "node:crypto";
import { getCache, waitUntil } from "@vercel/functions";
import { JiraError } from "./client";

// Two-level cache in front of Jira reads, per person, so one person's data is never shown to another.
//   L1: this server instance's memory.
//   L2: Vercel Runtime Cache, shared by every instance in the region and kept across deploys and cold starts.
// A copy is "fresh" for `ttlMs`. For a while after that it is still served instantly while a background refresh runs
// (stale-while-revalidate), so pages stay fast and Jira is asked once, not once per visitor. If Jira says 429, an older
// copy (up to 10 minutes) is shown, marked stale. Identical simultaneous requests share one Jira call.
// Writes clear that person's entries (memory immediately, Runtime Cache by tag).

type Stored = { at: number; v: unknown };
const l1 = new Map<string, Stored>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 400;
/** How old a copy may be when it's used because Jira is rate-limiting. */
export const STALE_OK_MS = 10 * 60_000;
/** After going stale, how long a copy is still served instantly while it refreshes in the background. */
export const SWR_MS = 5 * 60_000;

export const now = { fn: () => Date.now() };
let generation = 0;

// The package's default key hash is a short 32-bit one. Collisions between two people's keys would be a data leak, so use SHA-256.
const l2 = () => getCache({ namespace: "jira", keyHashFunction: (k: string) => createHash("sha256").update(k).digest("hex") });
const tag = (user: string) => `u:${user}`.slice(0, 200).replace(/,/g, "_");

async function l2Get(k: string): Promise<Stored | undefined> {
  try { return (await l2().get(k)) as Stored | undefined; } catch { return undefined; }
}
function l2Set(k: string, s: Stored, user: string) {
  const p = Promise.resolve(l2().set(k, s, { ttl: STALE_OK_MS / 1000, tags: [tag(user)], name: "jira-read" })).catch(() => {});
  try { waitUntil(p); } catch { /* not on Vercel */ }
}

function remember(k: string, s: Stored) {
  l1.set(k, s);
  if (l1.size > MAX_ENTRIES) l1.delete(l1.keys().next().value as string);
}

type Result<T> = { value: T; stale: boolean };
const refreshing = new Set<string>();

export async function cached<T>(user: string, key: string, ttlMs: number, load: () => Promise<T>): Promise<Result<T>> {
  const k = `${generation}|${user}|${key}`;

  const hit = l1.get(k);
  if (hit && now.fn() - hit.at < ttlMs) return { value: hit.v as T, stale: false };

  // Everyone asking for the same thing at once waits on one lookup (memory, then Runtime Cache, then Jira).
  const pending = inflight.get(k) as Promise<Result<T>> | undefined;
  if (pending) return pending;

  const lookup = (async (): Promise<Result<T>> => {
    let copy = l1.get(k);
    if (!copy || now.fn() - copy.at >= ttlMs) {
      const shared = await l2Get(k);
      if (shared && (!copy || shared.at > copy.at)) { copy = shared; remember(k, shared); }
    }
    const age = copy ? now.fn() - copy.at : Infinity;
    if (copy && age < ttlMs) return { value: copy.v as T, stale: false };

    const fetchFresh = async (): Promise<T> => {
      const value = await load();
      const s = { at: now.fn(), v: value };
      remember(k, s);
      l2Set(k, s, user);
      return value;
    };

    // Slightly old: answer now, refresh behind the scenes for the next person.
    if (copy && age < ttlMs + SWR_MS) {
      if (!refreshing.has(k)) {
        refreshing.add(k);
        const bg = fetchFresh().then(() => {}, () => {}).finally(() => refreshing.delete(k));
        try { waitUntil(bg); } catch { /* not on Vercel */ }
      }
      return { value: copy.v as T, stale: false };
    }

    try {
      return { value: await fetchFresh(), stale: false };
    } catch (e) {
      if (e instanceof JiraError && e.status === 429 && copy && age < STALE_OK_MS) return { value: copy.v as T, stale: true };
      throw e;
    }
  })().finally(() => inflight.delete(k));
  inflight.set(k, lookup);
  return lookup;
}

/** Forget everything cached for one person, after something they changed. */
export function invalidateUser(user: string): void {
  for (const k of l1.keys()) if (k.split("|")[1] === user) l1.delete(k);
  try { waitUntil(Promise.resolve(l2().expireTag(tag(user))).catch(() => {})); } catch { /* not on Vercel */ }
}

export const _clearCache = () => { l1.clear(); inflight.clear(); refreshing.clear(); generation++; };
