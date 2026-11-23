export type TagInfo = { n: string; m: string; s?: number; t: string[] };

/** Images that share the most tags with `id`, rarer tags counting for more (so "holding tablet" outweighs "adult"). */
export function relatedTo(id: string, all: Record<string, TagInfo>, limit = 8): string[] {
  const me = all[id];
  if (!me) return [];
  const freq = new Map<string, number>();
  for (const e of Object.values(all)) for (const t of e.t) freq.set(t, (freq.get(t) ?? 0) + 1);
  const mine = new Set(me.t);
  const scored: [string, number, number][] = [];
  for (const [oid, e] of Object.entries(all)) {
    if (oid === id) continue;
    let score = 0;
    let shared = 0;
    for (const t of e.t) if (mine.has(t)) { shared++; score += 1 / Math.sqrt(freq.get(t) ?? 1); }
    if (shared >= 2) scored.push([oid, score, shared]);
  }
  return scored.sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, limit).map((x) => x[0]);
}

/** Tags in this image's own order, which already lists the most useful first. */
export const labelOf = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
