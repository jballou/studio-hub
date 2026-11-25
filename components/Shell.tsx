"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NewProjectButton } from "./NewProjectButton";

/**
 * The slim bar above each page: the page's title (drawn here by PageTitle) and the New project button.
 * Pages that sit inside a record, like a project, draw their own breadcrumb, so the bar never adds a second one.
 * The review workspace and sign-in pages have their own headers.
 */
export function TopBar() {
  const pathname = usePathname();
  const inWorkspace = /^\/review\/[^/]+/.test(pathname);
  if (inWorkspace || pathname === "/signin" || pathname === "/welcome") return null;
  // Preferences has its own tab strip right below, so the bar drops its title and its rule to avoid a double stripe.
  const prefs = pathname.startsWith("/admin");
  return (
    <header className={`shrink-0 text-sm text-muted ${prefs ? "" : "border-b border-line"}`}>
      <div className="column flex h-16 items-center gap-4">
        {/* Phones: the sidebar is a drawer, opened from here. */}
        <button onClick={() => window.dispatchEvent(new Event("sidebar-open"))} aria-label="Open menu" className="btn btn-ghost btn-icon -ml-2 shrink-0 md:hidden"><Icon name="menu" size={20} /></button>
        {!prefs && <div id="page-title" className="min-w-0 truncate text-xl font-bold text-ink empty:hidden" />}
        <div className="ml-auto"><NewProjectButton /></div>
      </div>
    </header>
  );
}
