import { isoDate } from "./csv";

export const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = fromIso(s);
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
export const startOfWeek = (s: string) => addDays(s, -fromIso(s).getDay());
export const todayIso = () => isoDate(new Date());

/** 6 weeks of ISO dates covering the month containing `cursor` (Sunday start). */
export function monthGrid(cursor: string): string[] {
  const d = fromIso(cursor);
  const first = isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const monthLabel = (s: string) => fromIso(s).toLocaleDateString("en-US", { month: "long", year: "numeric" });
export const dayLabel = (s: string, o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  fromIso(s).toLocaleDateString("en-US", o);
export const shiftMonth = (s: string, n: number) => {
  const d = fromIso(s);
  return isoDate(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

/** Dates an item occupies (start to end, capped so a bad end date can't flood the grid). */
export function spanDays(date: string, endDate?: string): string[] {
  if (!endDate || endDate <= date) return [date];
  const out: string[] = [];
  for (let d = date; d <= endDate && out.length < 31; d = addDays(d, 1)) out.push(d);
  return out;
}
