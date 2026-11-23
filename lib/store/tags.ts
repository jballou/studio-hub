import { readDoc, updateDoc } from "./doc";

// Auto-generated tags for brand library images, kept in one small document per library (about 100 bytes per image).
export type TagEntry = { n: string; m: string; s?: number; t: string[]; at: number };
type Doc = { items: Record<string, TagEntry> };
const empty = (): Doc => ({ items: {} });
const name = (kind: string) => `brand/tags-${kind}`;

export async function allTags(kind: string): Promise<Record<string, TagEntry>> {
  return (await readDoc(name(kind), empty)).data.items;
}

export async function saveTags(kind: string, id: string, entry: TagEntry): Promise<void> {
  await updateDoc(name(kind), empty, (d) => ({ data: { items: { ...d.items, [id]: entry } }, result: undefined }));
}
