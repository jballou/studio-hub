import { driveFile, driveNode } from "@/lib/google/client";
import { readDoc, updateDoc } from "./doc";
import { AdminError, audit } from "./users";

// The brand library keeps big files (photos, illustrations) in shared Google Drive folders. An admin points the Hub at
// the folders; the Hub reads them with that admin's Google connection and serves them to signed-in staff.
export type BrandKind = "photos" | "illustrations";
export type BrandConfig = { photos: string; illustrations: string; /** the admin whose Google connection reads Drive */ owner: string };

const empty = (): BrandConfig => ({ photos: "", illustrations: "", owner: "" });
export async function getBrandConfig(): Promise<BrandConfig> {
  return (await readDoc("brand/config", empty)).data;
}

/** A folder id from a Drive link (…/folders/<id>) or a bare id. */
export function folderIdFrom(input: string): string {
  const t = input.trim();
  if (!t) return "";
  const m = /\/folders\/([A-Za-z0-9_-]{10,100})/.exec(t) ?? /[?&]id=([A-Za-z0-9_-]{10,100})/.exec(t);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,100}$/.test(t) ? t : "";
}

export async function setBrandConfig(admin: string, input: { photos?: unknown; illustrations?: unknown }): Promise<BrandConfig> {
  const next: BrandConfig = { photos: "", illustrations: "", owner: admin };
  for (const k of ["photos", "illustrations"] as const) {
    const raw = String(input[k] ?? "").trim();
    if (!raw) continue;
    const id = folderIdFrom(raw);
    if (!id) throw new AdminError(400, `The ${k} link isn't a Google Drive folder link.`);
    let f;
    try { f = await driveFile(admin, id); } catch { throw new AdminError(400, `Your Google account can't open the ${k} folder. Check the link and that it's shared with you.`); }
    if (f.mimeType !== "application/vnd.google-apps.folder") throw new AdminError(400, `The ${k} link is a file, not a folder.`);
    next[k] = id;
  }
  await updateDoc("brand/config", empty, () => ({ data: next, result: undefined }));
  await audit({ actor: admin, action: "brand.config", target: "brand", detail: `photos ${next.photos ? "set" : "off"}, illustrations ${next.illustrations ? "set" : "off"}` });
  return next;
}

const seen = new Map<string, { ok: boolean; at: number }>();
/** Things listed inside a folder already checked to be in the library are in the library too, so opening each one needs no climb up the tree. */
export function markInTree(kind: BrandKind, ids: string[]): void {
  const at = Date.now();
  for (const id of ids) seen.set(`${kind}:${id}`, { ok: true, at });
  if (seen.size > 5000) for (const k of [...seen.keys()].slice(0, 1000)) seen.delete(k);
}
/** True when `id` is the configured folder or somewhere inside it (up to 8 levels), so the Hub never serves other Drive files. */
export async function inBrandTree(cfg: BrandConfig, kind: BrandKind, id: string): Promise<boolean> {
  const root = cfg[kind];
  if (!root || !cfg.owner) return false;
  const key = `${kind}:${id}`;
  const hit = seen.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.ok;
  let ok = false;
  let cur = id;
  for (let depth = 0; depth < 8; depth++) {
    if (cur === root) { ok = true; break; }
    const n = await driveNode(cfg.owner, cur).catch(() => null);
    if (!n || !n.parents.length) break;
    cur = n.parents[0];
  }
  seen.set(key, { ok, at: Date.now() });
  return ok;
}

/** Folder names from the library root down to `id`, for the breadcrumb. */
export async function brandTrail(cfg: BrandConfig, kind: BrandKind, id: string): Promise<{ id: string; name: string }[]> {
  const trail: { id: string; name: string }[] = [];
  let cur = id;
  for (let depth = 0; depth < 8; depth++) {
    const n = await driveNode(cfg.owner, cur).catch(() => null);
    if (!n) break;
    trail.unshift({ id: n.id, name: n.name });
    if (cur === cfg[kind] || !n.parents.length) break;
    cur = n.parents[0];
  }
  return trail;
}
