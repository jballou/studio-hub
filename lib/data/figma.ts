import { parseFigmaLink, type FigmaFile } from "@/lib/figma";
import { isJira } from "./mode";

export type FramesResult =
  | { state: "ok"; file: FigmaFile; selected: string | null }
  /** No Figma access token is set up, so frames and thumbnails can't be listed. */
  | { state: "not-configured" }
  | { state: "error"; message: string };

export interface FigmaRepo {
  frames(url: string): Promise<FramesResult>;
  /** Thumbnail URLs by frame id. Frames Figma can't render are simply missing. */
  thumbs(key: string, ids: string[]): Promise<Record<string, string>>;
}

const jiraFigma: FigmaRepo = {
  async frames(url) {
    const res = await fetch(`/api/figma/frames?url=${encodeURIComponent(url)}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (body.configured === false) return { state: "not-configured" };
    if (!res.ok || body.error) return { state: "error", message: body.error ?? `Couldn't load the file (${res.status}).` };
    return { state: "ok", file: body.file, selected: body.selected ?? null };
  },
  async thumbs(key, ids) {
    const out: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 50) {
      const res = await fetch("/api/figma/thumbs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, ids: ids.slice(i, i + 50) }) });
      if (res.ok) Object.assign(out, (await res.json()).urls);
    }
    return out;
  },
};

// Demo mode: a made-up file with drawn placeholder thumbnails, so the picker can be tried without a Figma token.
const palette = ["#d9f0f2", "#ededfd", "#f9e8d2", "#d6f5de", "#f9f2d2", "#f7dbd4"];
const thumb = (label: string, i: number) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="${palette[i % palette.length]}"/><rect x="14" y="14" width="70" height="8" rx="3" fill="#0f2e21" opacity=".7"/><rect x="14" y="30" width="110" height="5" rx="2" fill="#0f2e21" opacity=".3"/><rect x="14" y="40" width="90" height="5" rx="2" fill="#0f2e21" opacity=".3"/><rect x="14" y="70" width="40" height="16" rx="8" fill="#08794a"/><text x="146" y="92" font-size="9" text-anchor="end" fill="#0f2e21" opacity=".5">${label}</text></svg>`,
)}`;
const DEMO_NAMES = ["Hero, 1:1", "Hero, 4:5", "Hero, 9:16", "Carousel 1", "Carousel 2", "Carousel 3", "Carousel 4", "End card", "Story frame A", "Story frame B"];
const demoFile = (key: string): FigmaFile => ({
  key, name: "Spring campaign: social ads",
  pages: [
    { id: "0:1", name: "Ads", frames: DEMO_NAMES.slice(0, 3).map((n, i) => ({ id: `1:${i + 1}`, name: n, w: 1080, h: i === 0 ? 1080 : i === 1 ? 1350 : 1920 })) },
    { id: "0:2", name: "Carousel", frames: DEMO_NAMES.slice(3, 8).map((n, i) => ({ id: `2:${i + 1}`, name: n, w: 1080, h: 1080, section: "LinkedIn carousel" })) },
    { id: "0:3", name: "Stories", frames: DEMO_NAMES.slice(8).map((n, i) => ({ id: `3:${i + 1}`, name: n, w: 1080, h: 1920 })) },
  ],
});
const demoFigma: FigmaRepo = {
  async frames(url) {
    const link = parseFigmaLink(url);
    if (!link) return { state: "error", message: "Paste a Figma design link (Share → Copy link)." };
    return { state: "ok", file: demoFile(link.key), selected: link.nodeId };
  },
  async thumbs(_key, ids) {
    return Object.fromEntries(ids.map((id, i) => [id, thumb(id, i)]));
  },
};

export const figmaRepo: FigmaRepo = isJira ? jiraFigma : demoFigma;
