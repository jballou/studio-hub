"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

const ITEMS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/projects", label: "Projects", icon: "folder", match: (p) => p === "/projects" },
  { href: "/review", label: "Review", icon: "comment", match: (p) => p.startsWith("/review") },
];

/**
 * Persistent app nav. Full width on normal pages; collapses to an icon rail inside
 * the full-screen review workspace so the design and comments keep their space.
 */
export function Sidebar() {
  const pathname = usePathname();
  const collapsed = /^\/review\/[^/]+/.test(pathname);

  const link = (active: boolean) =>
    `flex items-center gap-3 rounded-lg py-2 text-sm font-medium ${collapsed ? "justify-center px-2" : "px-3"} ${active ? "bg-brand-soft text-ink" : "text-n-800 hover:bg-n-150"}`;

  return (
    <nav
      aria-label="Main"
      className={`sticky top-0 flex h-screen shrink-0 flex-col gap-1 border-r border-line bg-white p-3 ${collapsed ? "w-16" : "w-56"}`}
    >
      <Link href="/projects" className={`mb-4 flex items-center gap-2 px-1 py-1 font-bold text-brand ${collapsed ? "justify-center" : ""}`} title="Brand Creative Hub">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm text-n-50">BC</span>
        {!collapsed && <span className="leading-tight">Brand Creative Hub</span>}
      </Link>

      <Link
        href="/projects/new"
        title="New brief"
        aria-label="New brief"
        className={`mb-3 flex items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-medium text-n-50 hover:bg-brand-dark ${collapsed ? "px-2" : "px-3"}`}
      >
        <Icon name="plus" size={16} />
        {!collapsed && "New brief"}
      </Link>

      {ITEMS.map((i) => {
        const active = i.match(pathname);
        return (
          <Link key={i.href} href={i.href} title={i.label} aria-label={i.label} aria-current={active ? "page" : undefined} className={link(active)}>
            <Icon name={i.icon} size={18} />
            {!collapsed && i.label}
          </Link>
        );
      })}
    </nav>
  );
}
