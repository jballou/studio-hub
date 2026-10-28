// Finds the playable video file behind a Wistia link so the Hub can use its own player.
// Wistia's public embed data lists every MP4 rendition of a video that is viewable on the web. Nothing here needs a token.

export type WistiaMedia = {
  hashedId: string;
  name: string;
  duration?: number;
  assets?: { type?: string; container?: string | null; width?: number; height?: number; size?: number; url?: string }[];
};

export type WistiaResolved = { id: string; name: string; duration?: number; streamUrl: string; width: number; height: number };

const ID = "[a-z0-9]{6,12}";

/** Hosts we are willing to fetch from the server (so this can't be pointed at anything else). */
export function allowedWistiaHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "wistia.com" || h.endsWith(".wistia.com") || h === "fast.wistia.net" || h === "wistia.net";
}

/** The video id from a link that contains it: /medias/<id>, /embed/iframe/<id>, /embed/medias/<id>. */
export function idFromUrl(u: URL): string | null {
  return new RegExp(`/(?:medias|iframe)/(${ID})(?![a-z0-9])`, "i").exec(u.pathname)?.[1] ?? null;
}

/** A share link (…wistia.com/s/<code>) is a page; the video id is inside it. */
export const isShareLink = (u: URL) => /^\/s\/[a-z0-9]+\/?$/i.test(u.pathname);

export function idFromSharePage(html: string): string | null {
  return new RegExp(`embed/(?:iframe|medias)/(${ID})(?![a-z0-9])`, "i").exec(html)?.[1]
    ?? new RegExp(`wistia_async_(${ID})(?![a-z0-9])`, "i").exec(html)?.[1]
    ?? null;
}

/** Picks the biggest MP4 up to 1080p. The untouched original is skipped: it can be gigabytes. */
export function pickRendition(media: WistiaMedia): { url: string; width: number; height: number } | null {
  const mp4 = (media.assets ?? []).filter((a) => a.container === "mp4" && a.url && a.type !== "original" && (a.width ?? 0) > 0);
  const fit = mp4.filter((a) => (a.width ?? 0) <= 1920).sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const best = fit[0] ?? mp4.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
  if (!best?.url) return null;
  // The delivery URL ends in .bin; the same address with .mp4 is served as video/mp4 with range support.
  return { url: best.url.replace(/\.bin(\?.*)?$/, ".mp4$1"), width: best.width ?? 0, height: best.height ?? 0 };
}

export function toResolved(media: WistiaMedia): WistiaResolved | null {
  const r = pickRendition(media);
  if (!r) return null;
  return { id: media.hashedId, name: media.name, duration: media.duration, streamUrl: r.url, width: r.width, height: r.height };
}
