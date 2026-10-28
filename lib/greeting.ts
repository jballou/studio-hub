// The line at the top of My Day. Add more entries to GREETINGS to change or extend it; the first one whose hours match wins.
export type Greeting = { text: string; /** local hours, start inclusive, end exclusive. Wraps past midnight when start > end. */ from: number; to: number };

export const GREETINGS: Greeting[] = [
  { text: "Good morning", from: 5, to: 12 },
  { text: "Good afternoon", from: 12, to: 17 },
  { text: "Good evening", from: 17, to: 22 },
];

/** Used when no entry matches (late at night) and before the time is known. */
export const FALLBACK_GREETING = "Welcome back";

export function greetingFor(hour: number | null): string {
  if (hour === null) return FALLBACK_GREETING;
  const hit = GREETINGS.find((g) => (g.from <= g.to ? hour >= g.from && hour < g.to : hour >= g.from || hour < g.to));
  return hit?.text ?? FALLBACK_GREETING;
}
