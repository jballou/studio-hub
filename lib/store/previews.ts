import { readDoc, updateDoc } from "./doc";

// Which PNGs in a library have transparent pixels (1) and which are fully opaque (0). The preview route uses it: an opaque PNG
// can use Drive's own fast thumbnail, while a transparent one must be shrunk from the original to keep its see-through background.
// Only the background warm-up writes this, once per image.
type Doc = { items: Record<string, 0 | 1> };
const empty = (): Doc => ({ items: {} });
const name = (kind: string) => `brand/preview-alpha-${kind}`;

export async function alphaFlags(kind: string): Promise<Record<string, 0 | 1>> {
  return (await readDoc(name(kind), empty)).data.items;
}

export async function saveAlphaFlags(kind: string, flags: Record<string, 0 | 1>): Promise<void> {
  if (Object.keys(flags).length === 0) return;
  await updateDoc(name(kind), empty, (d) => ({ data: { items: { ...d.items, ...flags } }, result: undefined }));
}
