import type { Device, SourceKind } from "./types";

export type ParsedSource =
  | {
      ok: true;
      kind: SourceKind;
      summary: string;
      suggestedTitle: string;
      embedUrl: string;
      aspect: number;
      /** natural width in px; zoom percentages are relative to it */
      baseWidth: number;
      warnings: string[];
    }
  | { ok: false; error: string };

const fail = (error: string): ParsedSource => ({ ok: false, error });

function toUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

/**
 * Hosts we refuse to point a server-side fetch or an iframe at: loopback, private
 * ranges and bare IPs. Keeps a future screenshot/ingest worker from being aimed at
 * internal services (SSRF). The real adapter must re-check after DNS resolution.
 */
export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || /\.(localhost|local|internal|lan|corp)$/.test(h)) return true;
  if (h.includes(":") || h.startsWith("[")) return true; // IPv6 literal
  if (/^\d+(\.\d+){3}$/.test(h)) return true; // any IPv4 literal
  return false;
}

export type Shape = "16:10" | "16:9" | "4:3" | "1:1" | "9:16";
export const SHAPES: { id: Shape; label: string; aspect: number }[] = [
  { id: "16:10", label: "Desktop (16:10)", aspect: 16 / 10 },
  { id: "16:9", label: "Widescreen (16:9)", aspect: 16 / 9 },
  { id: "4:3", label: "Standard (4:3)", aspect: 4 / 3 },
  { id: "1:1", label: "Square (1:1)", aspect: 1 },
  { id: "9:16", label: "Mobile (9:16)", aspect: 9 / 16 },
];
const shapeAspect = (s: Shape) => SHAPES.find((x) => x.id === s)?.aspect ?? 16 / 10;

const ASPECT = { figma: 16 / 10, slides: 16 / 9, drive: 16 / 9, desktop: 1440 / 900, mobile: 390 / 844 };

function parseFigma(u: URL, shape: Shape): ParsedSource {
  if (!/^(www\.)?figma\.com$/.test(u.hostname)) return fail("That isn't a figma.com link.");
  const m = /^\/(design|file|proto|board|make)\/([A-Za-z0-9]+)(?:\/([^/?]+))?/.exec(u.pathname);
  if (!m) return fail("Paste a Figma share link (Share → Copy link).");
  const node = u.searchParams.get("node-id");
  const warnings: string[] = [];
  if (!node && m[1] !== "make") warnings.push("This links to the whole file. Right-click the frame and choose “Copy link to selection” so reviewers see just that frame.");
  if (m[1] === "board") warnings.push("FigJam boards are shown as a single view; pins won't follow panning.");
  warnings.push("Reviewers need view access to the Figma file.");
  const name = m[3] ? decodeURIComponent(m[3]).replace(/-/g, " ") : "Figma frame";
  return {
    ok: true, kind: "figma",
    summary: `Figma ${m[1]} · ${node ? `frame ${node.replace("-", ":")}` : "whole file"}`,
    suggestedTitle: name,
    // hide-ui drops Figma's own chrome; scaling=contain fills the frame to the canvas so pins line up with it.
    embedUrl: `https://www.figma.com/embed?embed_host=brand-creative-hub&hide-ui=1&scaling=contain&url=${encodeURIComponent(u.toString())}`,
    aspect: shapeAspect(shape), baseWidth: 1440, warnings,
  };
}

function parseSlides(u: URL): ParsedSource {
  if (u.hostname !== "docs.google.com") return fail("That isn't a Google Slides link.");
  const m = /^\/presentation\/d\/([A-Za-z0-9_-]+)/.exec(u.pathname);
  if (!m) return fail("Paste the URL of a Google Slides deck.");
  return {
    ok: true, kind: "slides", summary: "Google Slides deck", suggestedTitle: "Google Slides deck",
    embedUrl: `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`,
    aspect: ASPECT.slides, baseWidth: 1280,
    warnings: ["Set sharing to “Anyone at SurveyMonkey with the link can view”.", "Reviewers see the deck as it is now. Resubmit to freeze a new version."],
  };
}

function parseDrive(u: URL, shape: Shape): ParsedSource {
  if (u.hostname === "docs.google.com") {
    return fail(/\/presentation\//.test(u.pathname) ? "That's a Slides deck. Choose “Google Slides” instead." : "Docs and Sheets aren't supported. Share a media file (video, audio, image or PDF).");
  }
  if (u.hostname !== "drive.google.com") return fail("That isn't a Google Drive link.");
  if (/\/drive\/(u\/\d+\/)?folders\//.test(u.pathname)) return fail("That links to a folder. Share the file itself.");
  const id = /^\/file\/d\/([A-Za-z0-9_-]+)/.exec(u.pathname)?.[1] ?? u.searchParams.get("id");
  if (!id) return fail("Paste a Drive file link (Share → Copy link).");
  return {
    ok: true, kind: "drive", summary: "Google Drive file", suggestedTitle: "Drive file",
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    aspect: shapeAspect(shape), baseWidth: 1280,
    warnings: ["Set sharing to “Anyone at SurveyMonkey with the link can view”.", "Drive previews can't report playback time, so video and audio comments won't get timecodes until the file is imported."],
  };
}

function parseStaging(u: URL, device: Device): ParsedSource {
  if (u.protocol !== "https:") return fail("Staging links must start with https://.");
  if (isBlockedHost(u.hostname)) return fail("Use the staging hostname, not localhost or an IP address.");
  return {
    ok: true, kind: "staging", summary: `Landing page · ${u.hostname}`, suggestedTitle: u.hostname,
    embedUrl: u.toString(), aspect: ASPECT[device], baseWidth: device === "mobile" ? 390 : 1440,
    warnings: [
      "Many sites refuse to load inside another page. If the preview is blank, upload a screenshot instead.",
      "Staging behind login or VPN won't load for reviewers outside it.",
      "Pins mark a spot in the visible area; they don't follow scrolling.",
    ],
  };
}

export function parseSource(kind: Exclude<SourceKind, "upload">, raw: string, device: Device = "desktop", shape: Shape = "16:10"): ParsedSource {
  if (!raw.trim()) return fail("");
  const u = toUrl(raw);
  if (!u || !/^https?:$/.test(u.protocol)) return fail("That doesn't look like a link.");
  switch (kind) {
    case "figma": return parseFigma(u, shape);
    case "slides": return parseSlides(u);
    case "drive": return parseDrive(u, shape);
    case "staging": return parseStaging(u, device);
  }
}
