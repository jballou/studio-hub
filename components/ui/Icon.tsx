// Simple stroke icons used by status UI. Placeholder until the brand icon set is available.
const PATHS = {
  submitted: <><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></>,
  review: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  progress: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" /></>,
  feedback: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></>,
  delivered: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.8" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z" /><path d="M10.300 21a1.900 1.900 0 0 0 3.400 0" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.700L21 8" /><path d="M21 3v5h-5" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></>,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="8" cy="8" r="1.500" fill="currentColor" /></>,
  users: <><circle cx="9" cy="8" r="3.500" /><path d="M2 20a7 7 0 0 1 14 0M16 4.500a3.500 3.500 0 0 1 0 7M18 20a6 6 0 0 0-3-5.200" /></>,
  star: <><path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9Z" /></>,
  block: <><circle cx="12" cy="12" r="9" /><path d="m5.700 5.700 12.600 12.600" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.700 9.700 0 0 0 4-.9" /></>,
  reply: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v3" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  at: <><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>,
  chevronRight: <><path d="m9 6 6 6-6 6" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  comment: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M8.500 11h7M8.500 14h4" /></>,
  ticket: <><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M9 5v14" strokeDasharray="2 2.500" /></>,
  task: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.500 12.200 2.500 2.500 4.500-4.800" /></>,
  // Brand "sliders" icon (filled, drawn on a 16px grid, so it's scaled up to this file's 24px grid)
  sliders: <g transform="scale(1.5)"><path d="M3.89655 8C4.29648 8 4.62069 8.33579 4.62069 8.75V15.25C4.62069 15.6642 4.29648 16 3.89655 16C3.49662 16 3.17241 15.6642 3.17241 15.25V8.75C3.17241 8.33579 3.49662 8 3.89655 8ZM12.1034 12C12.5034 12 12.8276 12.3358 12.8276 12.75V15.25C12.8276 15.6642 12.5034 16 12.1034 16C11.7035 16 11.3793 15.6642 11.3793 15.25V12.75C11.3793 12.3358 11.7035 12 12.1034 12ZM9.93104 10.5C9.5311 10.5 9.2069 10.1642 9.2069 9.75C9.2069 9.33579 9.5311 9 9.93104 9H11.3793V0.75C11.3793 0.335786 11.7035 0 12.1034 0C12.5034 0 12.8276 0.335786 12.8276 0.75V9H14.2759C14.6758 9 15 9.33579 15 9.75C15 10.1642 14.6758 10.5 14.2759 10.5H9.93104ZM3.89655 0C4.29648 0 4.62069 0.335786 4.62069 0.75V5H6.06897C6.4689 5 6.7931 5.33579 6.7931 5.75C6.7931 6.16421 6.4689 6.5 6.06897 6.5H1.72414C1.32421 6.5 1 6.16421 1 5.75C1 5.33579 1.32421 5 1.72414 5H3.17241V0.75C3.17241 0.335786 3.49662 0 3.89655 0Z" fillRule="evenodd" clipRule="evenodd" /></g>,
  // Lucide: log-out
  logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  // Lucide: file-text
  brief: <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
  // Lucide: moon, sun, volume-2, volume-x, zap (epic), target (initiative), corner-down-right (sub-task), bookmark (story), link-2
  moon: <><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
  volumeOn: <><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" /></>,
  volumeOff: <><path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z" /><path d="m16.5 14.5 5-5" /><path d="m16.5 9.5 5 5" /></>,
  epic: <><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.500 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.560l9-9A1.5 1.5 0 0018.500 10h-3.997a.5.5 0 01-.472-.667z" /></>,
  initiative: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  subtask: <><path d="m15 10 5 5-5 5" /><path d="M4 4v7a4 4 0 0 0 4 4h12" /></>,
  story: <><path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" /></>,
  // Lucide: calendar-days, calendar-minus-2, square-kanban, text-align-start
  calendarDays: <><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M8 13h.01" /><path d="M12 13h.01" /><path d="M16 13h.01" /><path d="M8 17h.01" /><path d="M12 17h.01" /><path d="M16 17h.01" /></>,
  calendarWeek: <><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M10 15h4" /></>,
  kanban: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 7v7" /><path d="M12 7v4" /><path d="M16 7v9" /></>,
  listStart: <><path d="M21 5H3" /><path d="M15 12H3" /><path d="M17 19H3" /></>,
  close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
} as const;

export type IconName = keyof typeof PATHS;

/** Icons drawn as filled shapes rather than strokes. */
const FILLED: ReadonlySet<IconName> = new Set<IconName>(["sliders"]);

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}
