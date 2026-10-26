// CSV and date parsing ported from the social content calendar (content-calendar.html).
// Dates are returned as YYYY-MM-DD strings so they sort and compare without timezone surprises.

export function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = ""; rows.push(row); row = [];
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function mk(y: number, m: number, d: number): Date | null {
  const x = new Date(y, m, d);
  return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d ? x : null;
}

/** A date without a year ("Mon, Oct 19") takes the nearby year whose weekday matches. */
function resolveYear(month: number, day: number, weekday: number | null, year: number | null, today: Date): Date | null {
  if (year != null) return mk(year, month, day);
  const ty = today.getFullYear();
  if (weekday != null) {
    const c = [ty - 1, ty, ty + 1]
      .map((y) => mk(y, month, day))
      .filter((d): d is Date => !!d && d.getDay() === weekday);
    if (c.length) return c.sort((a, b) => Math.abs(+a - +today) - Math.abs(+b - +today))[0];
  }
  return mk(ty, month, day);
}

export function parseDate(raw: unknown, today: Date = new Date()): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[,\s]+$/, "");
  if (!s || /^(n\/?a|tbd|tba|-+|none)$/i.test(s)) return null;
  let m: RegExpMatchArray | null;
  const out = (d: Date | null) => (d ? isoDate(d) : null);
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return out(mk(+m[1], +m[2] - 1, +m[3]));
  const low = s.toLowerCase();
  const wdm = low.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
  const wd = wdm ? WEEKDAYS.indexOf(wdm[1]) : null;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/))) {
    let a = +m[1];
    let b = +m[2];
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    if (a > 12) [a, b] = [b, a];
    return out(resolveYear(a - 1, b, wd, y, today));
  }
  const mo = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
  let r = low.match(new RegExp(`\\b${mo}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`));
  if (r) return out(resolveYear(MONTHS.indexOf(r[1]), +r[2], wd, r[3] ? +r[3] : null, today));
  r = low.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${mo}(?:,?\\s+(\\d{4}))?`));
  if (r) return out(resolveYear(MONTHS.indexOf(r[2]), +r[1], wd, r[3] ? +r[3] : null, today));
  const n = Date.parse(s);
  return isNaN(n) ? null : isoDate(new Date(n));
}

export function parseTime(raw: unknown): number | null {
  if (!raw) return null;
  const s = String(raw);
  let m = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/i);
  if (m) {
    let h = +m[1] % 12;
    if (m[3].toLowerCase() === "p") h += 12;
    return h * 60 + (+m[2] || 0);
  }
  m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return m ? +m[1] * 60 + +m[2] : null;
}

export function formatTime(min: number | null | undefined): string {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return `${h % 12 || 12}${mm ? ":" + pad(mm) : ""} ${h < 12 ? "AM" : "PM"}`;
}
