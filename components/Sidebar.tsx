"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { projectsRepo, repo } from "@/lib/data";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/review/Avatar";
import { SearchDialog } from "./SearchDialog";

const PREF_KEY = "sidebar-pref-v1";

const ITEMS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/projects", label: "Projects", icon: "folder", match: (p) => p === "/projects" || p === "/projects/new" },
  { href: "/review", label: "Review", icon: "comment", match: (p) => p.startsWith("/review") },
  { href: "/submit", label: "Submit for feedback", icon: "upload", match: (p) => p === "/submit" },
];

/**
 * Persistent app nav with an expanded and a collapsed (icon rail) mode. The toggle is
 * always visible. Without a saved choice it starts collapsed inside the review
 * workspace (to give the design room) and expanded elsewhere.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [pref, setPref] = useState<"expanded" | "collapsed" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [me, setMe] = useState<User>();
  const [alerts, setAlerts] = useState(0);

  useEffect(() => {
    try {
      const v = localStorage.getItem(PREF_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "expanded" || v === "collapsed") setPref(v);
    } catch { /* storage unavailable */ }
    repo.listUsers().then((u) => setMe(u.find((x) => x.id === "u-avery")));
    projectsRepo.listProjects("u-avery").then((ps) =>
      setAlerts(ps.reduce((n, p) => n + p.newComments + (p.actionRequired ? 1 : 0), 0)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const inWorkspace = /^\/review\/[^/]+/.test(pathname);
  const collapsed = (pref ?? (inWorkspace ? "collapsed" : "expanded")) === "collapsed";

  const toggle = () => {
    const next = collapsed ? "expanded" : "collapsed";
    setPref(next);
    try { localStorage.setItem(PREF_KEY, next); } catch { /* ignore */ }
  };

  const row = (active: boolean) =>
    `flex items-center gap-3 rounded-lg py-2 text-sm font-medium ${collapsed ? "justify-center px-2" : "px-3"} ${active ? "bg-n-200 text-ink" : "text-n-800 hover:bg-n-150"}`;

  const toggleBtn = (
    <button
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-n-800 hover:bg-n-150"
    >
      <Icon name="panel" size={18} />
    </button>
  );

  return (
    <>
      <nav
        aria-label="Main"
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-n-50 p-3 transition-[width] duration-150 ${collapsed ? "w-16" : "w-60"}`}
      >
        <div className={`mb-3 flex ${collapsed ? "flex-col items-center gap-2" : "items-center gap-2"}`}>
          <Link href="/projects" title="Brand Creative Hub" className="flex min-w-0 flex-1 items-center gap-2 font-bold text-ink">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm text-n-50">BC</span>
            {!collapsed && <span className="truncate leading-tight">Brand Creative Hub</span>}
          </Link>
          {toggleBtn}
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          title="Search (⌘K)"
          className={`mb-3 flex items-center gap-2 rounded-lg border border-control bg-white py-2 text-sm text-n-700 hover:bg-n-150 ${collapsed ? "justify-center px-2" : "px-3"}`}
        >
          <Icon name="search" size={16} />
          {!collapsed && (<><span className="flex-1 text-left">Search</span><kbd className="text-xs">⌘K</kbd></>)}
        </button>

        <Link
          href="/projects/new"
          title="New brief"
          aria-label="New brief"
          className={`mb-3 flex items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-medium text-n-50 hover:bg-brand-dark ${collapsed ? "px-2" : "px-3"}`}
        >
          <Icon name="plus" size={16} />
          {!collapsed && "New brief"}
        </Link>

        <div className="flex flex-col gap-1">
          {ITEMS.map((i) => {
            const active = i.match(pathname);
            return (
              <Link key={i.href} href={i.href} title={i.label} aria-label={i.label} aria-current={active ? "page" : undefined} className={row(active)}>
                <Icon name={i.icon} size={18} />
                {!collapsed && i.label}
              </Link>
            );
          })}
        </div>

        <div className={`mt-auto flex border-t border-line pt-3 ${collapsed ? "flex-col items-center gap-2" : "items-center gap-2"}`}>
          <Avatar user={me} size={32} />
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{me?.name ?? ""}</span>
              <span className="block text-xs capitalize text-muted">{me?.role ?? ""}</span>
            </span>
          )}
          <Link
            href="/projects"
            aria-label={alerts > 0 ? `Notifications: ${alerts} need attention` : "Notifications"}
            title="Notifications"
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-n-800 hover:bg-n-150"
          >
            <Icon name="bell" size={18} />
            {alerts > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-bad-fg ring-2 ring-n-50" />}
          </Link>
        </div>
      </nav>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}
