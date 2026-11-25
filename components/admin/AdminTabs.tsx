"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useMe } from "@/hooks/useMe";

const TABS: { href: string; label: string; adminOnly: boolean; icon: IconName }[] = [
  { href: "/admin/brief", label: "Brief builder", adminOnly: false, icon: "flowVertical" },
  { href: "/admin/users", label: "Team & access", adminOnly: true, icon: "folderUsers" },
  { href: "/admin/okr", label: "OKRs", adminOnly: true, icon: "goal" },
  { href: "/admin/brand", label: "Brand library", adminOnly: true, icon: "bookType" },
  { href: "/admin/tags", label: "Image tags", adminOnly: false, icon: "tags" },
  { href: "/admin/agent", label: "Bot sandbox", adminOnly: true, icon: "bot" },
  { href: "/admin/activity", label: "Activity", adminOnly: true, icon: "activity" },
  { href: "/admin/settings", label: "Settings", adminOnly: true, icon: "cog" },
  { href: "/admin/system", label: "System", adminOnly: true, icon: "wrench" },
  { href: "/admin/trash", label: "Trash", adminOnly: false, icon: "trash" },
];

/** The whole creative team can edit the brief questions; people, activity and system checks are for admins. */
export function AdminTabs() {
  const pathname = usePathname();
  const me = useMe();
  return (
    <nav aria-label="Admin sections" className="@container flex items-end gap-2 border-b border-line px-4 pt-4 md:px-8">
      {TABS.filter((t) => !t.adminOnly || me?.isAdmin).map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} title={t.label} aria-current={active ? "page" : undefined} className={`-mb-px flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-tight border px-4 text-sm font-medium ${active ? "border-line border-b-background bg-background text-brand" : "border-transparent bg-n-150 text-n-700 hover:bg-n-200 hover:text-n-1000"}`}>
            <Icon name={t.icon} size={16} /><span className={active ? "" : "sr-only @[88rem]:not-sr-only"}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
