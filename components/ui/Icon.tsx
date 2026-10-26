// Simple stroke icons used by status UI. Placeholder until the brand icon set is available.
const PATHS = {
  submitted: <><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></>,
  review: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  progress: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" /></>,
  feedback: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></>,
  delivered: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.8" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}
