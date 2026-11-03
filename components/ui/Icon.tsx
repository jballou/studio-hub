// Simple stroke icons used by status UI. Placeholder until the brand icon set is available.
const PATHS = {
  submitted: <><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></>,
  review: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  progress: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" /></>,
  feedback: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></>,
  delivered: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.8" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  play: <><polygon points="6 3 20 12 6 21 6 3" /></>,
  pause: <><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></>,
  chartColumn: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>,
  lock: <><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z" /><path d="M10.300 21a1.900 1.900 0 0 0 3.400 0" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.700L21 8" /><path d="M21 3v5h-5" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></>,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="8" cy="8" r="1.500" fill="currentColor" /></>,
  star: <><path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9Z" /></>,
  block: <><circle cx="12" cy="12" r="9" /><path d="m5.700 5.700 12.600 12.600" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.700 9.700 0 0 0 4-.9" /></>,
  reply: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v3" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  bang: <><path d="M12 4v10M12 19v.01" /></>,
  bangs: <><path d="M8 4v10M8 19v.01M16 4v10M16 19v.01" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  arrowDown: <><path d="M12 5v14M6 13l6 6 6-6" /></>,
  chevronsUpDown: <><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></>,
  chevronsDownUp: <><path d="m7 20 5-5 5 5M7 4l5 5 5-5" /></>,
  pencil: <><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.090 9a3 3 0 0 1 5.830 1c0 2-3 3-3 3" /><path d="M12 17h.010" /></>,
  bookOpen: <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></>,
  hash: <><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></>,
  externalLink: <><path d="M15 3h6v6M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  userRound: <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  usersRound: <><path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" /></>,
  at: <><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>,
  chevronRight: <><path d="m9 6 6 6-6 6" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  comment: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M8.500 11h7M8.500 14h4" /></>,
  ticket: <><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M9 5v14" strokeDasharray="2 2.500" /></>,
  task: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.500 12.200 2.500 2.500 4.500-4.800" /></>,
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
  // Lucide: folder, folder-users, calendar, calendar-days, calendar-minus-2, layout-dashboard, messages-square, ban, sliders-vertical, list-checks, trash-2
  folder: <><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></>,
  folderUsers: <><path d="M5.254 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2V9.255" /><circle cx="13" cy="15" r="3" /><path d="M17 22a4 4 0 0 0-8 0" /><path d="M22 22A4 4 0 0 0 20.24 18.686 1 1 0 0 1 20.1 17.143 3 3 0 0 0 19.5 12.402" /></>,
  calendar: <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>,
  calendarDays: <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></>,
  calendarWeek: <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M10 16h4" /></>,
  layoutDashboard: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  messagesSquare: <><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></>,
  ban: <><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" /></>,
  listChecks: <><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><path d="M10 11v6M14 11v6" /></>,
  // Lucide: git-branch-plus, graph-hub
  gitBranchPlus: <><path d="M6 3v12" /><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M15 6a9 9 0 0 0-9 9" /><path d="M18 15v6" /><path d="M21 18h-6" /></>,
  graphHub: <><circle cx="12" cy="7" r="4" /><circle cx="4" cy="19" r="2" /><circle cx="12" cy="19" r="2" /><circle cx="20" cy="19" r="2" /><path d="M8 7a4 4 0 0 0-4 4v6" /><path d="M12 11v6" /><path d="M16 7a4 4 0 0 1 4 4v6" /></>,
  // Lucide: grip-vertical, delete
  gripVertical: <><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></>,
  delete: <><path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" /><path d="m12 9 6 6" /><path d="m18 9-6 6" /></>,
  // Lucide: square-kanban, text-align-start, mouse-pointer-2
  pointer: <><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" /></>,
  kanban: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 7v7" /><path d="M12 7v4" /><path d="M16 7v9" /></>,
  listStart: <><path d="M21 5H3" /><path d="M15 12H3" /><path d="M17 19H3" /></>,
  close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 14, fill = false }: { name: IconName; size?: number; /** fill a stroke icon (e.g. a solid play triangle) */ fill?: boolean }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}
