import { readDoc, updateDoc } from "./doc";

// Tags for brand library images (automatic, then editable by the creative team), kept in one small document per library
// (about 100 bytes per image). `ed` marks a list a person has edited, so re-tagging never overwrites their work.
export type TagEntry = { n: string; m: string; s?: number; t: string[]; at: number; ed?: boolean };
type Doc = { items: Record<string, TagEntry> };
const empty = (): Doc => ({ items: {} });
const name = (kind: string) => `brand/tags-${kind}`;

export async function allTags(kind: string): Promise<Record<string, TagEntry>> {
  return (await readDoc(name(kind), empty)).data.items;
}

/** A tag as stored: lowercase, plain, short. */
export const cleanTag = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 \-+]/g, "").trim().slice(0, 32);
export const cleanTags = (list: unknown): string[] => [...new Set((Array.isArray(list) ? list : []).map((t) => cleanTag(String(t))).filter(Boolean))].slice(0, 24);

/** Saves an automatic result, unless someone has already edited this image's tags. */
export async function saveTags(kind: string, id: string, entry: TagEntry): Promise<TagEntry> {
  return updateDoc(name(kind), empty, (d) => {
    const cur = d.items[id];
    if (cur?.ed) return { data: d, result: cur };
    return { data: { items: { ...d.items, [id]: entry } }, result: entry };
  });
}

/** A person's edit of one image's tags. */
export async function editTags(kind: string, id: string, tags: string[]): Promise<TagEntry | null> {
  return updateDoc(name(kind), empty, (d) => {
    const cur = d.items[id];
    if (!cur) return { data: d, result: null };
    const next = { ...cur, t: tags, ed: true, at: Date.now() };
    return { data: { items: { ...d.items, [id]: next } }, result: next };
  });
}

/** Rename (to a name) or delete (to null) one tag on every image. Returns how many images changed. */
export async function rewriteTag(kind: string, from: string, to: string | null): Promise<number> {
  return updateDoc(name(kind), empty, (d) => {
    let n = 0;
    const items: Record<string, TagEntry> = {};
    for (const [id, e] of Object.entries(d.items)) {
      if (!e.t.includes(from)) { items[id] = e; continue; }
      n++;
      const t = [...new Set(e.t.map((x) => (x === from ? to : x)).filter((x): x is string => !!x))];
      items[id] = { ...e, t, ed: true };
    }
    return { data: { items }, result: n };
  });
}

// A short lock so only one background tagging run goes at a time, and idle libraries aren't re-walked on every visit.
type Lock = { until: number; idleUntil: number };
const lockName = (kind: string) => `brand/tag-lock-${kind}`;
export async function takeTagLock(kind: string, forMs: number): Promise<boolean> {
  // A plain read first, so a busy or idle library costs no write.
  const cur = (await readDoc<Lock>(lockName(kind), () => ({ until: 0, idleUntil: 0 }))).data;
  if (Date.now() < cur.until || Date.now() < cur.idleUntil) return false;
  return updateDoc<Lock, boolean>(lockName(kind), () => ({ until: 0, idleUntil: 0 }), (l) => {
    const now = Date.now();
    if (now < l.until || now < l.idleUntil) return { data: l, result: false };
    return { data: { ...l, until: now + forMs }, result: true };
  });
}
export async function releaseTagLock(kind: string, idleForMs: number): Promise<void> {
  await updateDoc<Lock>(lockName(kind), () => ({ until: 0, idleUntil: 0 }), () => ({ data: { until: 0, idleUntil: Date.now() + idleForMs }, result: undefined }));
}
