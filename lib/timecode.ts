/** 83000 -> "01:23"; an hour or more -> "1:02:03". */
export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** "1:23", "01:23", "1:02:03" or plain seconds ("83") to milliseconds. Null when it isn't a time. */
export function parseTimecode(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d{1,5}$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.length > 1 && n.slice(1).some((x) => x > 59)) return null;
  const secs = n.reduce((acc, x) => acc * 60 + x, 0);
  return secs * 1000;
}
