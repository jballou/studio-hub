import type { Device, SourceKind } from "./types";
import { allowedWistiaHost, idFromUrl, isShareLink } from "./wistia";

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
      /** the video id isn't in the link (a share link); the server has to look it up before this can be used */
      needsLookup?: boolean;
      /** Drive files the person says are video or audio: a direct stream for a real player with timestamps (the embed is the fallback). */
      media?: { kind: "audio" | "video"; streamUrl: string };
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

export type DriveType = "other" | "video" | "audio";

function parseDrive(u: URL, shape: Shape, type: DriveType): ParsedSource {
  if (u.hostname === "docs.google.com") {
    return fail(/\/presentation\//.test(u.pathname) ? "That's a Slides deck. Choose “Google Slides” instead." : "Docs and Sheets aren't supported. Share a media file (video, audio, image or PDF).");
  }
  if (u.hostname !== "drive.google.com") return fail("That isn't a Google Drive link.");
  if (/\/drive\/(u\/\d+\/)?folders\//.test(u.pathname)) return fail("That links to a folder. Share the file itself.");
  const id = /^\/file\/d\/([A-Za-z0-9_-]+)/.exec(u.pathname)?.[1] ?? u.searchParams.get("id");
  if (!id) return fail("Paste a Drive file link (Share → Copy link).");
  const embedUrl = `https://drive.google.com/file/d/${id}/preview`;
  const sharing = "Set sharing to “Anyone at SurveyMonkey with the link can view”.";
  if (type === "audio" || type === "video") {
    return {
      ok: true, kind: "drive", summary: `Google Drive ${type} file`, suggestedTitle: `Drive ${type} file`,
      embedUrl, aspect: type === "audio" ? 16 / 9 : shapeAspect(shape), baseWidth: 1280,
      media: { kind: type, streamUrl: `https://drive.google.com/uc?export=download&id=${id}` },
      warnings: [
        sharing,
        `Reviewers play it right here, and each comment is stamped with the time. If Drive won't stream it (large files, or sharing limits), the Drive player opens instead and reviewers type the time themselves.`,
      ],
    };
  }
  return {
    ok: true, kind: "drive", summary: "Google Drive file", suggestedTitle: "Drive file",
    embedUrl, aspect: shapeAspect(shape), baseWidth: 1280,
    warnings: [sharing, "Choose Audio or Video above if this is a media file, so comments get timestamps."],
  };
}

/** LottieFiles: an embed or direct lottie.host file plays inline; a regular page link is shown as-is and may be blocked from framing. */
function parseLottie(u: URL): ParsedSource {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "lottie.host") {
    const m = /^\/(?:embed\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9-]+)\.(?:lottie|json)$/.exec(u.pathname);
    if (!m) return fail("Paste a LottieFiles embed link (Share → Embed), or the animation's page link.");
    return {
      ok: true, kind: "lottie", summary: "LottieFiles animation", suggestedTitle: "Lottie animation",
      embedUrl: `https://lottie.host/embed/${m[1]}/${m[2]}.lottie`, aspect: 1, baseWidth: 800,
      warnings: ["Reviewers see the animation looping; pins mark a spot in the visible frame."],
    };
  }
  if (host !== "lottiefiles.com" && !host.endsWith(".lottiefiles.com")) return fail("That isn't a LottieFiles link.");
  if (/^\/?$/.test(u.pathname)) return fail("Paste the link to a specific animation.");
  const name = /\/(?:animations?|free-animation|share)\/([^/?]+)/.exec(u.pathname)?.[1];
  return {
    ok: true, kind: "lottie", summary: "LottieFiles animation", suggestedTitle: name ? decodeURIComponent(name).replace(/-\d+$/, "").replace(/-/g, " ") : "Lottie animation",
    embedUrl: u.toString(), aspect: 1, baseWidth: 800,
    warnings: [
      "LottieFiles may refuse to load its pages inside another page. If the preview is blank, use Share → Embed on LottieFiles and paste the lottie.host link instead.",
      "Make sure the animation is public or shared with link access.",
    ],
  };
}

/** Wistia: a link to one video, from the Wistia app (…wistia.com/medias/<id>) or an embed link. Plays in Wistia's own player. */
function parseWistia(u: URL, shape: Shape): ParsedSource {
  const host = u.hostname.replace(/^www\./, "");
  if (!allowedWistiaHost(host)) return host === "wi.st" ? fail("Short wi.st links can't be read. Open the video in Wistia and copy its full link.") : fail("That isn't a Wistia link.");
  const id = idFromUrl(u);
  const share = isShareLink(u);
  if (!id && !share) return fail("Paste a link to one Wistia video: its page address (…/medias/…) or a share link (…/s/…).");
  return {
    ok: true, kind: "wistia", summary: "Wistia video", suggestedTitle: "Wistia video",
    embedUrl: id ? `https://fast.wistia.net/embed/iframe/${id}?videoFoam=true&playerColor=089b5e` : "",
    aspect: shapeAspect(shape), baseWidth: 1280, needsLookup: !id,
    media: { kind: "video", streamUrl: "" },
    warnings: ["The video must be viewable by your reviewers in Wistia (public, or shared with them)."],
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

export function parseSource(kind: Exclude<SourceKind, "upload">, raw: string, device: Device = "desktop", shape: Shape = "16:10", driveType: DriveType = "other"): ParsedSource {
  if (!raw.trim()) return fail("");
  const u = toUrl(raw);
  if (!u || !/^https?:$/.test(u.protocol)) return fail("That doesn't look like a link.");
  switch (kind) {
    case "figma": return parseFigma(u, shape);
    case "slides": return parseSlides(u);
    case "lottie": return parseLottie(u);
    case "wistia": return parseWistia(u, shape);
    case "drive": return parseDrive(u, shape, driveType);
    case "staging": return parseStaging(u, device);
  }
}
