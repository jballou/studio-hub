"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { blocksRepo, isJira } from "@/lib/data";
import { useFavorites } from "@/hooks/useFavorites";
import { useMe } from "@/hooks/useMe";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/review/Avatar";
import { SearchDialog } from "./SearchDialog";
import { ThemeToggle } from "./ThemeToggle";

const PREF_KEY = "sidebar-pref-v1";
const FAV_OPEN_KEY = "sidebar-favorites-open-v1";

type Item = { href: string; label: string; icon: IconName; match: (p: string) => boolean };

const ITEMS: Item[] = [
  { href: "/my-day", label: "My Day", icon: "check", match: (p) => p.startsWith("/my-day") },
  { href: "/projects", label: "Projects", icon: "folder", match: (p) => p === "/projects" || p === "/projects/new" },
  { href: "/calendar", label: "Calendar", icon: "calendar", match: (p) => p.startsWith("/calendar") },
  { href: "/review", label: "Review", icon: "comment", match: (p) => p.startsWith("/review") },
  { href: "/blocking", label: "Waiting on you", icon: "block", match: (p) => p.startsWith("/blocking") },
];

const ADMIN_ITEM: Item = { href: "/admin", label: "Admin", icon: "users", match: (p) => p.startsWith("/admin") };

/**
 * Persistent app nav with an expanded and a collapsed (icon rail) mode. The toggle is always visible.
 * Without a saved choice it starts collapsed inside the review workspace (to give the design room)
 * and expanded elsewhere. Admin and your own name sit at the bottom.
 */
export function Sidebar() {
  const pathname = usePathname();
  const me = useMe();
  const favs = useFavorites();
  const [pref, setPref] = useState<"expanded" | "collapsed" | null>(null);
  const [favOpen, setFavOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    try {
      const v = localStorage.getItem(PREF_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "expanded" || v === "collapsed") setPref(v);
      if (localStorage.getItem(FAV_OPEN_KEY) === "closed") setFavOpen(false);
    } catch { /* storage unavailable */ }
  }, []);

  // How many projects are waiting on me. Refreshed when blocks change and once a minute so a new block shows up unprompted.
  const refreshWaiting = useCallback(() => {
    blocksRepo.mine().then((b) => setWaiting(b.length)).catch(() => {});
  }, []);
  useEffect(() => {
    if (isJira && !me) return;
    refreshWaiting();
    window.addEventListener("blocks-changed", refreshWaiting);
    const t = setInterval(() => { if (document.visibilityState === "visible") refreshWaiting(); }, 60_000);
    return () => { window.removeEventListener("blocks-changed", refreshWaiting); clearInterval(t); };
  }, [me, refreshWaiting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pathname === "/signin") return null;
  const inWorkspace = /^\/review\/[^/]+/.test(pathname);
  const collapsed = (pref ?? (inWorkspace ? "collapsed" : "expanded")) === "collapsed";

  const setMode = (next: "expanded" | "collapsed") => {
    setPref(next);
    try { localStorage.setItem(PREF_KEY, next); } catch { /* ignore */ }
  };
  const toggle = () => setMode(collapsed ? "expanded" : "collapsed");
  const toggleFav = () => {
    const next = !favOpen;
    setFavOpen(next);
    try { localStorage.setItem(FAV_OPEN_KEY, next ? "open" : "closed"); } catch { /* ignore */ }
  };

  const user: User | undefined = me
    ? { id: me.id, name: me.name, role: me.role, initials: me.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() }
    : undefined;

  const row = (active: boolean) =>
    `relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium ${collapsed ? "justify-center px-2" : "px-3"} ${active ? "bg-n-200 text-ink" : "text-n-800 hover:bg-n-150"}`;

  const navLink = (i: Item, badge?: number) => {
    const active = i.match(pathname);
    return (
      <Link key={i.href} href={i.href} title={i.label} aria-label={badge ? `${i.label}, ${badge} waiting` : i.label} aria-current={active ? "page" : undefined} className={row(active)}>
        <Icon name={i.icon} size={18} />
        {!collapsed && <span className="flex-1">{i.label}</span>}
        {!!badge && (collapsed
          ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-bad-fg ring-2 ring-n-50" />
          : <span className="rounded-full bg-bad-fg px-1.5 text-xs font-semibold text-n-50">{badge}</span>)}
      </Link>
    );
  };

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
        <Link
          href="/submit"
          title="Submit for feedback"
          aria-label="Submit for feedback"
          aria-current={pathname === "/submit" ? "page" : undefined}
          className={`mb-3 flex items-center justify-center gap-2 rounded-lg border border-brand bg-white py-2 text-sm font-medium text-brand hover:bg-brand-soft ${collapsed ? "px-2" : "px-3"} ${pathname === "/submit" ? "bg-brand-soft" : ""}`}
        >
          <Icon name="upload" size={16} />
          {!collapsed && "Submit for feedback"}
        </Link>

        <div className="flex flex-col gap-1">{ITEMS.map((i) => navLink(i, i.href === "/blocking" ? waiting : undefined))}</div>

        {/* Favorites folder */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {collapsed ? (
            <button onClick={() => setMode("expanded")} title="Favorites" aria-label="Show favorites" className={row(false)}>
              <Icon name="star" size={18} />
            </button>
          ) : (
            <section aria-label="Favorites">
              <button onClick={toggleFav} aria-expanded={favOpen} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-n-700 hover:bg-n-150">
                <Icon name="star" size={14} />
                <span className="flex-1 text-left">Favorites</span>
                <span className={favOpen ? "" : "-rotate-90"}><Icon name="chevronDown" size={14} /></span>
              </button>
              {favOpen && (
                favs.items.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted">Star a project to pin it here.</p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {favs.items.map((f) => (
                      <li key={f.key}>
                        <Link
                          href={`/projects/${f.key}`}
                          title={`${f.key} · ${f.title}`}
                          aria-current={pathname === `/projects/${f.key}` ? "page" : undefined}
                          className={`block truncate rounded-lg py-1.5 pl-9 pr-3 text-sm ${pathname === `/projects/${f.key}` ? "bg-n-200 font-medium text-ink" : "text-n-800 hover:bg-n-150"}`}
                        >
                          {f.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          )}
        </div>

        {/* Bottom: Admin, then you */}
        <div className="border-t border-line pt-2">
          <div className={`mb-2 flex ${collapsed ? "justify-center" : "justify-start px-1"}`}><ThemeToggle vertical={collapsed} /></div>
          {(me?.isAdmin || me?.role === "creative") && <div className="mb-2">{navLink(ADMIN_ITEM)}</div>}
          <div className={`flex ${collapsed ? "flex-col items-center gap-2" : "items-center gap-2"}`}>
            <Avatar user={user} size={32} />
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium">{user?.name ?? ""}</span>
                <span className="block text-xs capitalize text-muted">{me ? (me.isAdmin ? "Admin" : me.role) : ""}</span>
              </span>
            )}
            <Link
              href={waiting > 0 ? "/blocking" : "/projects"}
              aria-label={waiting > 0 ? `Notifications: ${waiting} ${waiting === 1 ? "project is" : "projects are"} waiting on you` : "Notifications"}
              title={waiting > 0 ? `${waiting} waiting on you` : "Notifications"}
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-n-800 hover:bg-n-150"
            >
              <Icon name="bell" size={18} />
              {waiting > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad-fg px-1 text-[10px] font-bold leading-none text-n-50 ring-2 ring-n-50">{waiting}</span>}
            </Link>
          </div>
        </div>
      </nav>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}
