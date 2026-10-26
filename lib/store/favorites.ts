import { createHash } from "node:crypto";
import { readDoc, updateDoc } from "./doc";

export type Favorite = { key: string; title: string; addedAt: string };
type FavDoc = { items: Favorite[] };
const empty = (): FavDoc => ({ items: [] });
const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
const MAX = 100;

// One small document per person, named by a hash of their account id (no raw ids in blob paths).
const docName = (accountId: string) => `fav-${createHash("sha256").update(accountId).digest("hex").slice(0, 24)}`;

export async function listFavorites(accountId: string): Promise<Favorite[]> {
  return (await readDoc(docName(accountId), empty)).data.items;
}

/** Adds or removes a star. Returns the new list. */
export async function toggleFavorite(accountId: string, key: string, title: string, on: boolean): Promise<Favorite[]> {
  if (!KEY_RE.test(key)) throw new Error("bad key");
  return updateDoc(docName(accountId), empty, (d) => {
    const without = d.items.filter((f) => f.key !== key);
    const items = on ? [{ key, title: title.slice(0, 200), addedAt: new Date().toISOString() }, ...without].slice(0, MAX) : without;
    return { data: { items }, result: items };
  });
}
