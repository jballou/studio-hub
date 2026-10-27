// Organization-wide settings that admins control. Shared by the server and the admin screen.

export type Settings = {
  /** Closed projects older than this many days are left out of project lists. Open projects always show. */
  projectLookbackDays: number;
};

export const DEFAULT_SETTINGS: Settings = { projectLookbackDays: 90 };
export const LOOKBACK_PRESETS = [7, 30, 60, 90, 120, 365] as const;
export const LOOKBACK_MIN = 1;
export const LOOKBACK_MAX = 3650;

/** A whole number of days within range, or null. */
export function parseLookback(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= LOOKBACK_MIN && n <= LOOKBACK_MAX ? n : null;
}

/**
 * JQL that keeps every open ticket and only the closed ones finished inside the window. Tickets that were closed without
 * a resolution date are judged by when they were last updated.
 */
export function lookbackClause(days: number): string {
  return `(statusCategory != Done OR resolutiondate >= -${days}d OR (resolutiondate is EMPTY AND updated >= -${days}d))`;
}

export const lookbackLabel = (days: number): string => (days === 1 ? "the last day" : `the last ${days} days`);
