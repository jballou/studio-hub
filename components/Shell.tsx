"use client";

import { usePathname } from "next/navigation";
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
  return (
    <header className="shrink-0 border-b border-line text-sm text-muted">
      <div className="column flex h-16 items-center gap-4">
        <div id="page-title" className="min-w-0 truncate text-xl font-bold text-ink empty:hidden" />
        <div className="ml-auto"><NewProjectButton /></div>
      </div>
    </header>
  );
}
