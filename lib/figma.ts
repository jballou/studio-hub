// Figma helpers shared by the browser and the server routes. Nothing here holds a secret: the access token is
// passed in by the server routes, which read it from FIGMA_ACCESS_TOKEN.

export type FigmaFrame = { id: string; name: string; w: number; h: number; section?: string };
export type FigmaPage = { id: string; name: string; frames: FigmaFrame[] };
export type FigmaFile = { key: string; name: string; pages: FigmaPage[] };

const API = "https://api.figma.com/v1";

export class FigmaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** File key and (when the link points at one frame) its node id, from any Figma share link. */
export function parseFigmaLink(raw: string): { key: string; name: string; nodeId: string | null } | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (!/^(www\.)?figma\.com$/.test(u.hostname)) return null;
  const m = /^\/(design|file|proto|board|make)\/([A-Za-z0-9]+)(?:\/([^/?]+))?/.exec(u.pathname);
  if (!m || m[1] === "board" || m[1] === "make") return null;
  const node = u.searchParams.get("node-id");
  return { key: m[2], name: m[3] ? decodeURIComponent(m[3]).replace(/-/g, " ") : "Figma file", nodeId: node ? node.replace("-", ":") : null };
}

/** A share link that opens exactly one frame, the same shape Figma's "Copy link to selection" makes. */
export function frameLink(key: string, fileName: string, nodeId: string): string {
  const slug = encodeURIComponent(fileName.trim().replace(/\s+/g, "-") || "file");
  return `https://www.figma.com/design/${key}/${slug}?node-id=${nodeId.replace(":", "-")}`;
}

type Node = { id: string; name: string; type: string; absoluteBoundingBox?: { width: number; height: number }; children?: Node[] };
const FRAME_TYPES = new Set(["FRAME", "COMPONENT", "COMPONENT_SET"]);

/** Pages with their top-level frames, plus frames one level down inside sections. Hidden, empty and tiny nodes are skipped. */
export function framesFromDocument(doc: { children?: Node[] }): FigmaPage[] {
  const pages: FigmaPage[] = [];
  for (const page of doc.children ?? []) {
    if (page.type !== "CANVAS") continue;
    const frames: FigmaFrame[] = [];
    const add = (n: Node, section?: string) => {
      const b = n.absoluteBoundingBox;
      if (!b || b.width < 8 || b.height < 8) return;
      frames.push({ id: n.id, name: n.name || "Untitled frame", w: Math.round(b.width), h: Math.round(b.height), section });
    };
    for (const n of page.children ?? []) {
      if (FRAME_TYPES.has(n.type)) add(n);
      else if (n.type === "SECTION") for (const c of n.children ?? []) if (FRAME_TYPES.has(c.type)) add(c, n.name);
    }
    if (frames.length) pages.push({ id: page.id, name: page.name, frames });
  }
  return pages;
}

async function figma<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { "X-Figma-Token": token }, cache: "no-store" });
  if (res.status === 403) throw new FigmaError(403, "The Figma connection can't open this file. Share it with the Brand Creative Hub Figma account, or add frame links by hand.");
  if (res.status === 404) throw new FigmaError(404, "Figma couldn't find that file. Check the link.");
  if (res.status === 429) throw new FigmaError(429, "Figma is rate limiting requests. Try again in a minute.");
  if (!res.ok) throw new FigmaError(502, `Figma returned HTTP ${res.status}.`);
  return res.json() as Promise<T>;
}

export async function fetchFile(token: string, key: string): Promise<FigmaFile> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(key)) throw new FigmaError(400, "That doesn't look like a Figma file link.");
  const data = await figma<{ name: string; document: { children?: Node[] } }>(token, `/files/${key}?depth=3`);
  return { key, name: data.name, pages: framesFromDocument(data.document) };
}

/** Temporary image URLs (about 30 days) for up to 50 frames at a time. Missing frames are left out. */
export async function fetchThumbs(token: string, key: string, ids: string[]): Promise<Record<string, string>> {
  const wanted = [...new Set(ids)].filter((i) => /^\d+:\d+$/.test(i)).slice(0, 50);
  if (!wanted.length) return {};
  const data = await figma<{ images?: Record<string, string | null> }>(token, `/images/${key}?ids=${encodeURIComponent(wanted.join(","))}&format=png&scale=0.4`);
  return Object.fromEntries(Object.entries(data.images ?? {}).filter((e): e is [string, string] => !!e[1]));
}
