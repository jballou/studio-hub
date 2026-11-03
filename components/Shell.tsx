"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NewProjectButton } from "./NewProjectButton";

const SECTIONS: { prefix: string; label: string }[] = [
  { prefix: "/my-day", label: "My Day" }, { prefix: "/briefs", label: "My briefs" }, { prefix: "/projects", label: "Projects" },
  { prefix: "/team", label: "Team" }, { prefix: "/calendar", label: "Calendar" }, { prefix: "/review", label: "Review" },
  { prefix: "/blocking", label: "Waiting on you" }, { prefix: "/analytics", label: "Analytics" }, { prefix: "/admin", label: "Preferences" },
  { prefix: "/submit", label: "Submit for feedback" }, { prefix: "/account", label: "Account" },
];

/** The slim bar above each page: a breadcrumb only when you are inside something (a project, a sub-page), and the New project button. The review workspace and sign-in pages have their own headers. */
export function TopBar() {
  const pathname = usePathname();
  const inWorkspace = /^\/review\/[^/]+/.test(pathname);
  if (inWorkspace || pathname === "/signin" || pathname === "/welcome") return null;
  const section = SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  const rest = section ? pathname.slice(section.prefix.length).split("/").filter(Boolean) : [];
  // On a section's own page the page title already says where you are. Preferences has its own side menu, and "new" pages carry their own title.
  const crumb = !!section && rest.length > 0 && section.prefix !== "/admin" && rest[0] !== "new";
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-white px-4 text-sm text-muted md:px-8">
      {crumb && (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <Link href={section!.prefix} className="truncate hover:text-ink">{section.label}</Link>
          {rest.map((r, i) => (
            <span key={i} className="flex min-w-0 items-center gap-2">
              <Icon name="chevronRight" size={12} />
              <span className={`truncate ${i === rest.length - 1 ? "font-medium text-ink" : ""}`}>{decodeURIComponent(r)}</span>
            </span>
          ))}
        </nav>
      )}
      <div className="ml-auto"><NewProjectButton /></div>
    </header>
  );
}
