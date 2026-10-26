// Due dates are stored as an exact moment (UTC ISO string) plus the timezone the person picked,
// so "5:00 PM Pacific" means the same instant for everyone and displays correctly across daylight saving changes.

export const TIMEZONES: { id: string; label: string }[] = [
  { id: "America/Los_Angeles", label: "Pacific Time" },
  { id: "America/Denver", label: "Mountain Time" },
  { id: "America/Chicago", label: "Central Time" },
  { id: "America/New_York", label: "Eastern Time" },
  { id: "UTC", label: "UTC" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Dublin", label: "Dublin" },
  { id: "Europe/Berlin", label: "Central Europe" },
  { id: "Asia/Kolkata", label: "India" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Australia/Sydney", label: "Sydney" },
];

export const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Short name such as PDT or GMT+1 for a zone at a given moment. */
export function zoneAbbr(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** Options for a timezone picker. The viewer's own zone is added if it isn't in the common list. */
export function timezoneOptions(selected?: string): { id: string; label: string }[] {
  const known = new Set(TIMEZONES.map((t) => t.id));
  const extra = [localTimezone(), selected].filter((z): z is string => !!z && !known.has(z));
  const list = [...TIMEZONES, ...[...new Set(extra)].map((id) => ({ id, label: id.replace(/_/g, " ") }))];
  return list.map((t) => ({ id: t.id, label: `${t.label} (${zoneAbbr(t.id)})` }));
}

function offsetMinutes(tz: string, atMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(atMs)).map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return (wall - Math.floor(atMs / 1000) * 1000) / 60000;
}

/** "2026-10-27" + "17:00" in America/Los_Angeles becomes the matching UTC instant (ISO). */
export function zonedToInstant(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall - offsetMinutes(tz, wall) * 60000;
  t = wall - offsetMinutes(tz, t) * 60000; // second pass settles times near a daylight saving change
  return new Date(t).toISOString();
}

/**
 * "Tue, Oct 27, 5:00 PM PDT". If the viewer is in a different zone, their local time is added.
 * Falls back to a date-only string for older records saved without a time.
 */
export function formatDue(dueAt: string, tz = "UTC", viewerTz: string = localTimezone()): string {
  const when = new Date(dueAt);
  if (isNaN(+when)) return dueAt;
  const fmt = (zone: string, withDay: boolean) =>
    when.toLocaleString("en-US", {
      timeZone: zone, ...(withDay ? { weekday: "short", month: "short", day: "numeric" } : {}),
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  const main = fmt(tz, true);
  if (viewerTz === tz) return main;
  const sameWall = when.toLocaleString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) ===
    when.toLocaleString("en-US", { timeZone: viewerTz, hour: "numeric", minute: "2-digit" });
  return sameWall ? main : `${main} (${when.toLocaleString("en-US", { timeZone: viewerTz, hour: "numeric", minute: "2-digit", timeZoneName: "short" })} for you)`;
}
