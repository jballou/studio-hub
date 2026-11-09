// Calendar-week helpers. A week runs Monday to the next Monday, in UTC dates (a one-day edge case near midnight in other time zones is accepted).

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The Monday on or before this YYYY-MM-DD date. */
export function weekStartOf(date: string): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  const dow = new Date(t).getUTCDay(); // 0 = Sunday
  return iso(t - ((dow + 6) % 7) * DAY);
}

export type WeekWindow = { weekStart: string; /** first day of the next week (exclusive) */ weekEnd: string; fromIso: string; toIso: string };

export function weekWindow(weekStart: string): WeekWindow {
  const t = Date.parse(`${weekStart}T00:00:00Z`);
  return { weekStart, weekEnd: iso(t + 7 * DAY), fromIso: new Date(t).toISOString(), toIso: new Date(t + 7 * DAY).toISOString() };
}

export const inWindow = (isoTime: string | undefined, w: WeekWindow) => !!isoTime && isoTime >= w.fromIso && isoTime < w.toIso;
