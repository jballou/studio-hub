"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "Team & access" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/system", label: "System" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="mt-1 flex gap-6">
      {TABS.map((t) => {
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
