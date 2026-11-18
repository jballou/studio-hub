"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/brand", label: "Overview" },
  { href: "/brand/logos", label: "Logos" },
  { href: "/brand/colors", label: "Color" },
  { href: "/brand/type", label: "Typography" },
  { href: "/brand/photos", label: "Photos" },
  { href: "/brand/illustrations", label: "Illustrations" },
  { href: "/brand/icons", label: "Icons" },
];

export function BrandTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Brand library" className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => {
        const on = t.href === "/brand" ? pathname === "/brand" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} data-on={on} className="chip">
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
