"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

const SECTIONS: { prefix: string; label: string }[] = [
  { prefix: "/my-day", label: "My Day" }, { prefix: "/briefs", label: "My briefs" }, { prefix: "/projects", label: "Projects" },
  { prefix: "/team", label: "Team" }, { prefix: "/calendar", label: "Calendar" }, { prefix: "/review", label: "Review" },
  { prefix: "/blocking", label: "Waiting on you" }, { prefix: "/analytics", label: "Analytics" }, { prefix: "/admin", label: "Preferences" },
  { prefix: "/submit", label: "Submit for feedback" },
];

/** Date and time, ticking each minute, shown as a small status chip like a live clock. */
function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="h-8" />;
  const d = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-white px-4 text-xs font-medium text-n-800 tabular-nums">
      <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
      {d} · {t}
    </span>
  );
}

/** The slim bar above each page: where you are, and the time. The review workspace and sign-in pages have their own headers. */
export function TopBar() {
  const pathname = usePathname();
  const inWorkspace = /^\/review\/[^/]+/.test(pathname);
  if (inWorkspace || pathname === "/signin" || pathname === "/welcome") return null;
  const section = SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  const rest = section ? pathname.slice(section.prefix.length).split("/").filter(Boolean) : [];
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-white px-4 text-sm text-muted md:px-8">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        {section && <Link href={section.prefix} className={`truncate ${rest.length ? "hover:text-ink" : "font-medium text-ink"}`}>{section.label}</Link>}
        {rest.map((r, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2">
            <Icon name="chevronRight" size={12} />
            <span className={`truncate ${i === rest.length - 1 ? "font-medium text-ink" : ""}`}>{decodeURIComponent(r)}</span>
          </span>
        ))}
      </nav>
      <div className="ml-auto"><Clock /></div>
    </header>
  );
}
