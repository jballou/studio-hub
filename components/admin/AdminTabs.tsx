"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useMe } from "@/hooks/useMe";

const TABS: { href: string; label: string; adminOnly: boolean; icon?: boolean }[] = [
  { href: "/admin/brief", label: "Brief builder", adminOnly: false },
  { href: "/admin/users", label: "Team & access", adminOnly: true },
  { href: "/admin/okr", label: "OKRs", adminOnly: true },
  { href: "/admin/brand", label: "Brand library", adminOnly: true },
  { href: "/admin/tags", label: "Image tags", adminOnly: false },
  { href: "/admin/agent", label: "Bot sandbox", adminOnly: true },
  { href: "/admin/activity", label: "Activity", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
  { href: "/admin/system", label: "System", adminOnly: true },
  { href: "/admin/trash", label: "Trash", adminOnly: false, icon: true },
];

/** The whole creative team can edit the brief questions; people, activity and system checks are for admins. */
export function AdminTabs() {
  const pathname = usePathname();
  const me = useMe();
  return (
    <nav aria-label="Admin sections" className="flex flex-wrap items-end gap-2 border-b border-line px-4 pt-4 md:px-8">
      {TABS.filter((t) => !t.adminOnly || me?.isAdmin).map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`-mb-px flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-tight border px-4 text-sm font-medium ${active ? "border-line border-b-background bg-background text-brand" : "border-transparent bg-n-150 text-n-700 hover:bg-n-200 hover:text-n-1000"}`}>
            {t.icon && <Icon name="trash" size={14} />}{t.label}
          </Link>
        );
      })}
    </nav>
  );
}
