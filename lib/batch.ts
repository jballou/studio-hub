import { frameLink, type FigmaFile, type FigmaFrame } from "./figma";
import { parseSource } from "./sources";
import type { AssetKind, AssetSource, SubmitInput } from "./types";

/** One thing to review inside a submission. Several of these sent together are a batch. */
export type BatchItem = {
  key: string;
  title: string;
  source: AssetSource;
  assetKind: AssetKind;
  src: string;
  embedUrl?: string;
  aspect: number;
  baseWidth?: number;
  /** small preview shown in the list; absent when none is available */
  thumb?: string;
};

export type BatchInfo = { id: string; title: string; index: number; total: number };

let seq = 0;
export const itemKey = () => `item-${Date.now().toString(36)}-${seq++}`;

/** A batch item for one Figma frame. Aspect and width come from the frame itself so pins line up. */
export function figmaFrameItem(file: FigmaFile, frame: FigmaFrame, thumb?: string): BatchItem | null {
  const url = frameLink(file.key, file.name, frame.id);
  const p = parseSource("figma", url);
  if (!p.ok) return null;
  return {
    key: `figma-${file.key}-${frame.id}`,
    title: frame.name,
    source: { kind: "figma", url, label: `Figma frame · ${frame.name}` },
    assetKind: "embed",
    src: "",
    embedUrl: p.embedUrl,
    aspect: frame.w / frame.h,
    baseWidth: Math.min(Math.max(frame.w, 320), 1440),
    thumb,
  };
}

/** Frame node ids already in the list for this file, so the picker can show them as added. */
export function addedFrameIds(items: BatchItem[], fileKey: string): Set<string> {
  const ids = new Set<string>();
  for (const it of items) {
    if (it.source.kind !== "figma") continue;
    const m = /\/(?:design|file|proto)\/([A-Za-z0-9]+)\/.*[?&]node-id=([0-9]+-[0-9]+)/.exec(it.source.url);
    if (m && m[1] === fileKey) ids.add(m[2].replace("-", ":"));
  }
  return ids;
}

/** Name for the batch when the person doesn't type one. */
export function defaultBatchTitle(items: { title: string }[]): string {
  if (items.length <= 1) return items[0]?.title ?? "";
  return `${items[0].title} + ${items.length - 1} more`;
}

export function toSubmitInput(item: BatchItem, common: Omit<SubmitInput, "source" | "assetKind" | "src" | "embedUrl" | "aspect" | "baseWidth" | "title" | "batch">, batch?: BatchInfo): SubmitInput {
  return { ...common, title: item.title, source: item.source, assetKind: item.assetKind, src: item.src, embedUrl: item.embedUrl, aspect: item.aspect, baseWidth: item.baseWidth, batch };
}
