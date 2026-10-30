"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { blocksRepo, isJira } from "@/lib/data";
import { useFavorites } from "@/hooks/useFavorites";
import { useMe } from "@/hooks/useMe";
import { NotificationBell } from "./NotificationBell";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/review/Avatar";
import { SearchDialog } from "./SearchDialog";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "@/components/ui/Logo";

const PREF_KEY = "sidebar-pref-v1";
const FAV_OPEN_KEY = "sidebar-favorites-open-v1";

type Item = { href: string; label: string; icon: IconName; match: (p: string) => boolean; /** shown to requesters (and in the demo) but not to the creative team, who work from Projects */ forRequesters?: boolean; /** shown to the creative team only */ forCreatives?: boolean };

const ITEMS: Item[] = [
  { href: "/my-day", label: "My Day", icon: "dashboardAdd", match: (p) => p.startsWith("/my-day") },
  { href: "/briefs", label: "My briefs", icon: "brief", match: (p) => p.startsWith("/briefs"), forRequesters: true },
  { href: "/projects", label: "Projects", icon: "folderFilled", match: (p) => p === "/projects" || p === "/projects/new" },
  { href: "/team", label: "Team", icon: "users", match: (p) => p.startsWith("/team"), forCreatives: true },
  { href: "/calendar", label: "Calendar", icon: "calendarEdit", match: (p) => p.startsWith("/calendar") },
  { href: "/review", label: "Review", icon: "chat", match: (p) => p.startsWith("/review") },
  { href: "/blocking", label: "Waiting on you", icon: "danger", match: (p) => p.startsWith("/blocking") },
];

const ANALYTICS_ITEM: Item = { href: "/analytics", label: "Analytics", icon: "chartColumn", match: (p) => p.startsWith("/analytics") };
const ADMIN_ITEM: Item = { href: "/admin", label: "Preferences", icon: "sliders", match: (p) => p.startsWith("/admin") };

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

  // How many projects are waiting on me. Refreshed when blocks change and every two minutes so a new block shows up unprompted.
  const refreshWaiting = useCallback(() => {
    blocksRepo.count().then(setWaiting).catch(() => {});
  }, []);
  useEffect(() => {
    if (isJira && !me) return;
    refreshWaiting();
    window.addEventListener("blocks-changed", refreshWaiting);
    const t = setInterval(() => { if (document.visibilityState === "visible") refreshWaiting(); }, 120_000);
    return () => { window.removeEventListener("blocks-changed", refreshWaiting); clearInterval(t); };
  }, [me, refreshWaiting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pathname === "/signin" || pathname === "/welcome") return null;
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
    `relative flex items-center gap-2 rounded-tight py-2 text-sm font-medium ${collapsed ? "justify-center px-2" : "px-4"} ${active ? "bg-white text-ink shadow-sm" : "text-n-800 hover:bg-white/60"}`;

  const navLink = (i: Item, badge?: number) => {
    const active = i.match(pathname);
    return (
      <Link key={i.href} href={i.href} title={i.label} aria-label={badge ? `${i.label}, ${badge} waiting` : i.label} aria-current={active ? "page" : undefined} className={row(active)}>
        <Icon name={i.icon} size={18} />
        {!collapsed && <span className="flex-1">{i.label}</span>}
        {!!badge && (collapsed
          ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-round bg-bad-fg ring-2 ring-white" />
          : <span className="rounded-round bg-bad-fg px-2 text-xs font-bold text-n-50">{badge}</span>)}
      </Link>
    );
  };

  const toggleBtn = (
    <button
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-tight text-n-800 hover:bg-white/60"
    >
      <Icon name="panel" size={18} />
    </button>
  );

  return (
    <>
      <nav
        aria-label="Main"
        className={`sticky top-0 flex h-screen shrink-0 flex-col p-4 transition-[width] duration-150 ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className={`mb-4 flex ${collapsed ? "flex-col items-center gap-2" : "items-center gap-2"}`}>
          <Link href="/my-day" title="Brand Creative Hub" className="flex min-w-0 flex-1 items-center gap-2 font-bold text-ink">
            <Logo size={32} />
            {!collapsed && <span className="truncate">Brand Creative Hub</span>}
          </Link>
          {toggleBtn}
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          title="Search (⌘K)"
          className={`btn btn-md btn-secondary mb-2 w-full font-normal text-n-700 ${collapsed ? "!px-0" : ""}`}
        >
          <Icon name="search" size={16} />
          {!collapsed && (<><span className="flex-1 text-left">Search</span><kbd className="text-xs">⌘K</kbd></>)}
        </button>

        <Link
          href="/my-day?new=task"
          title="New task"
          aria-label="New task"
          className={`btn btn-md btn-secondary mb-2 w-full border-brand text-brand ${collapsed ? "!px-0" : ""}`}
        >
          <Icon name="listChecks" size={16} />
          {!collapsed && "New task"}
        </Link>
        <Link
          href="/submit"
          title="Submit for feedback"
          aria-label="Submit for feedback"
          aria-current={pathname === "/submit" ? "page" : undefined}
          className={`btn btn-md btn-secondary mb-4 w-full border-brand text-brand ${collapsed ? "!px-0" : ""} ${pathname === "/submit" ? "!bg-brand-soft" : ""}`}
        >
          <Icon name="upload" size={16} />
          {!collapsed && "Submit for feedback"}
        </Link>

        {!collapsed && <p className="mb-2 px-4 text-muted eyebrow">Workspace</p>}
        <div className="flex flex-col">{ITEMS.filter((i) => (!i.forRequesters || !isJira || me?.role === "requester") && (!i.forCreatives || !isJira || me?.role === "creative")).map((i) => navLink(i, i.href === "/blocking" ? waiting : undefined))}</div>

        {/* Favorites folder */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {collapsed ? (
            <button onClick={() => setMode("expanded")} title="Favorites" aria-label="Show favorites" className={row(false)}>
              <Icon name="star" size={18} />
            </button>
          ) : (
            <section aria-label="Favorites">
              <button onClick={toggleFav} aria-expanded={favOpen} className="flex w-full items-center gap-2 rounded-tight px-4 py-2 text-n-700 hover:bg-white/60 eyebrow">
                <Icon name="star" size={14} />
                <span className="flex-1 text-left">Favorites</span>
                <span className={favOpen ? "" : "-rotate-90"}><Icon name="chevronDown" size={14} /></span>
              </button>
              {favOpen && (
                favs.items.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-muted">Star a project to pin it here.</p>
                ) : (
                  <ul className="mt-0 space-y-0">
                    {favs.items.map((f) => (
                      <li key={f.key}>
                        <Link
                          href={`/projects/${f.key}`}
                          title={`${f.key} · ${f.title}`}
                          aria-current={pathname === `/projects/${f.key}` ? "page" : undefined}
                          className={`block truncate rounded-tight py-2 pl-10 pr-4 text-sm ${pathname === `/projects/${f.key}` ? "bg-n-200 font-medium text-ink" : "text-n-800 hover:bg-white/60"}`}
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

        <Link
          href="/projects/new"
          title="New brief"
          aria-label="New brief"
          className={`btn btn-md btn-primary mb-4 w-full ${collapsed ? "!px-0" : ""}`}
        >
          <Icon name="plus" size={16} />
          {!collapsed && "New brief"}
        </Link>

        {/* Bottom: Admin, then you */}
        <div className="pt-2">
          <div className={`mb-2 flex ${collapsed ? "justify-center" : "justify-start px-2"}`}><ThemeToggle vertical={collapsed} /></div>
          {(!isJira || me?.role === "creative") && <div>{navLink(ANALYTICS_ITEM)}</div>}
          {(me?.isAdmin || me?.role === "creative") && <div className="mb-2">{navLink(ADMIN_ITEM)}</div>}
          <div className={`flex rounded-loose bg-white shadow-sm ${collapsed ? "flex-col items-center gap-2 p-2" : "items-center gap-2 p-2"}`}>
            <Avatar user={user} size={32} />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user?.name ?? ""}</span>
                <span className="block text-xs capitalize text-muted">{me ? (me.isAdmin ? "Admin" : me.role) : ""}</span>
              </span>
            )}
            <NotificationBell waiting={waiting} collapsed={collapsed} ready={!isJira || !!me} />
            {/* Real sign-in only; the demo has no account to sign out of. */}
            {isJira && (
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-tight text-n-800 hover:bg-n-150"
              >
                <Icon name="logOut" size={18} />
              </button>
            )}
          </div>
        </div>
      </nav>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}
