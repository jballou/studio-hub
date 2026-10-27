"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/useMe";

const TABS = [
  { href: "/admin/brief", label: "Brief builder", adminOnly: false },
  { href: "/admin/users", label: "Team & access", adminOnly: true },
  { href: "/admin/activity", label: "Activity", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
  { href: "/admin/system", label: "System", adminOnly: true },
];

/** The whole creative team can edit the brief questions; people, activity and system checks are for admins. */
export function AdminTabs() {
  const pathname = usePathname();
  const me = useMe();
  return (
    <nav aria-label="Admin sections" className="mt-1 flex gap-6">
      {TABS.filter((t) => !t.adminOnly || me?.isAdmin).map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`-mb-px border-b-2 pb-2 text-sm font-medium ${active ? "border-brand text-brand" : "border-transparent text-n-800 hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
