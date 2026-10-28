import type { AssetKind } from "./types";

// Some browsers and operating systems report no MIME type (or a generic one) for audio files, so the extension decides when the type is silent.
const AUDIO: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", wave: "audio/wav", flac: "audio/flac",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", weba: "audio/webm", aif: "audio/aiff", aiff: "audio/aiff", caf: "audio/x-caf",
};
const VIDEO: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", ogv: "video/ogg" };

const ext = (name: string) => /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";

export function kindFromFile(f: { name: string; type: string }): AssetKind | null {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("audio/")) return "audio";
  if (f.type.startsWith("video/")) return "video";
  if (f.type === "application/pdf") return "pdf";
  const e = ext(f.name);
  if (AUDIO[e]) return "audio";
  if (VIDEO[e]) return "video";
  if (e === "pdf") return "pdf";
  return null;
}

/** The MIME type to test playback with: what the file says, else what its extension implies. */
export const mimeOf = (f: { name: string; type: string }): string => f.type || AUDIO[ext(f.name)] || VIDEO[ext(f.name)] || "";

/** Passed to <input type="file" accept>. Extensions are listed too, since some pickers match on them. */
export const ACCEPT = ["image/*", "video/*", "audio/*", "application/pdf", ...Object.keys(AUDIO).map((e) => `.${e}`)].join(",");

export const AUDIO_EXTENSIONS = Object.keys(AUDIO);

/** Largest file the Hub stores itself (per upload). Bigger videos are shared as a link. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
