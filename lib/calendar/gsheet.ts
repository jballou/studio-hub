/** Normalizes a Google Sheets link to its CSV export URL. Returns null if it isn't one. */
export function toCsvExportUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com") return null;
  const gid = u.searchParams.get("gid") ?? /gid=(\d+)/.exec(u.hash)?.[1] ?? "0";
  if (!/^\d+$/.test(gid)) return null;
  const published = /^\/spreadsheets\/d\/e\/([A-Za-z0-9_-]+)/.exec(u.pathname);
  if (published) return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv&gid=${gid}`;
  const m = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(u.pathname);
  if (!m) return null;
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}
