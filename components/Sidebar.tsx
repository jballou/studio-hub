"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { blocksRepo, isJira } from "@/lib/data";
import { useFavorites } from "@/hooks/useFavorites";
import { useMe } from "@/hooks/useMe";
import { NotificationBell } from "./NotificationBell";
import type { User } from "@/lib/types";
import { SearchDialog } from "./SearchDialog";
import { UserMenu } from "./UserMenu";
import { HelpDialog } from "./HelpDialog";
import { Logo } from "@/components/ui/Logo";

const PREF_KEY = "sidebar-pref-v1";
const FAV_OPEN_KEY = "sidebar-favorites-open-v1";
const WORK_OPEN_KEY = "sidebar-workspace-open-v1";
const BRAND_OPEN_KEY = "sidebar-brand-open-v1";

/** The Brand Assets folder: each library in the brand area, one click away. */
const BRAND_ITEMS: { href: string; label: string; icon: IconName | "goldie" }[] = [
  { href: "/brand/logos", label: "Logos", icon: "goldie" },
  { href: "/brand/type", label: "Type", icon: "languages" },
  { href: "/brand/colors", label: "Color", icon: "swatchBook" },
  { href: "/brand/photos", label: "Photos", icon: "image" },
  { href: "/brand/illustrations", label: "Illustrations", icon: "pencilRuler" },
  { href: "/brand/icons", label: "Icons", icon: "target" },
];

type Item = { href: string; label: string; icon: IconName; match: (p: string) => boolean; /** shown to requesters (and in the demo) but not to the creative team, who work from Projects */ forRequesters?: boolean; /** shown to the creative team only */ forCreatives?: boolean; /** lets the onboarding tour point at this item */ tour?: string };

const ITEMS: Item[] = [
  { href: "/my-day", label: "My Day", icon: "layoutDashboard", match: (p) => p.startsWith("/my-day") },
  { href: "/briefs", label: "My briefs", icon: "brief", match: (p) => p.startsWith("/briefs"), forRequesters: true },
  { href: "/projects", label: "Projects", icon: "folder", match: (p) => p === "/projects" || p === "/projects/new", tour: "projects" },
  { href: "/intake", label: "Intake", icon: "inbox", match: (p) => p.startsWith("/intake"), forCreatives: true },
  { href: "/team", label: "Team", icon: "usersRound", match: (p) => p.startsWith("/team"), forCreatives: true },
  { href: "/reports", label: "Reports", icon: "listChecks", match: (p) => p.startsWith("/reports"), forCreatives: true },
  { href: "/calendar", label: "Calendar", icon: "calendar", match: (p) => p.startsWith("/calendar") },
  { href: "/review", label: "Review", icon: "messagesSquare", match: (p) => p.startsWith("/review"), tour: "review" },
  { href: "/blocking", label: "Waiting on you", icon: "ban", match: (p) => p.startsWith("/blocking"), tour: "blocking" },
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
  const [workOpen, setWorkOpen] = useState(true);
  const [brandOpen, setBrandOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [waiting, setWaiting] = useState(0);
  // Under 768px the sidebar is a drawer over the page, closed until someone opens it.
  const [phone, setPhone] = useState(false);
  // The drawer is open for the page it was opened on, so going to another page closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const drawer = openAt === pathname;
  const setDrawer = useCallback((v: boolean) => setOpenAt(v ? pathname : null), [pathname]);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const q = window.matchMedia("(max-width: 767px)");
    const on = () => { setPhone(q.matches); if (!q.matches) setOpenAt(null); };
    on();
    q.addEventListener("change", on);
    const open = () => setOpenAt(window.location.pathname);
    window.addEventListener("sidebar-open", open);
    return () => { q.removeEventListener("change", on); window.removeEventListener("sidebar-open", open); };
  }, []);
  // Escape closes the drawer, and focus moves into it when it opens.
  useEffect(() => {
    if (!drawer) return;
    toggleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, setDrawer]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(PREF_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "expanded" || v === "collapsed") setPref(v);
      if (localStorage.getItem(FAV_OPEN_KEY) === "closed") setFavOpen(false);
      if (localStorage.getItem(WORK_OPEN_KEY) === "closed") setWorkOpen(false);
      if (localStorage.getItem(BRAND_OPEN_KEY) === "closed") setBrandOpen(false);
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
  const collapsed = !phone && (pref ?? (inWorkspace ? "collapsed" : "expanded")) === "collapsed";

  const setMode = (next: "expanded" | "collapsed") => {
    setPref(next);
    try { localStorage.setItem(PREF_KEY, next); } catch { /* ignore */ }
  };
  const toggle = () => (phone ? setDrawer(false) : setMode(collapsed ? "expanded" : "collapsed"));
  const toggleWork = () => {
    const next = !workOpen;
    setWorkOpen(next);
    try { localStorage.setItem(WORK_OPEN_KEY, next ? "open" : "closed"); } catch { /* ignore */ }
  };
  const toggleBrand = () => {
    const next = !brandOpen;
    setBrandOpen(next);
    try { localStorage.setItem(BRAND_OPEN_KEY, next ? "open" : "closed"); } catch { /* ignore */ }
  };
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
      <Link key={i.href} href={i.href} data-tour={i.tour} title={i.label} aria-label={badge ? `${i.label}, ${badge} waiting` : i.label} aria-current={active ? "page" : undefined} className={row(active)}>
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
      ref={toggleRef}
      onClick={toggle}
      aria-label={phone ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={phone ? drawer : !collapsed}
      title={phone ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="btn btn-ghost btn-icon shrink-0 text-n-800"
    >
      <Icon name="panel" size={18} />
    </button>
  );

  return (
    <>
      {phone && drawer && <div onClick={() => setDrawer(false)} aria-hidden="true" className="fixed inset-0 z-40 bg-n-1000/50" />}
      {/* The workspace has no top bar, so phones get their own menu button there. */}
      {phone && inWorkspace && !drawer && (
        <button onClick={() => setDrawer(true)} aria-label="Open menu" className="btn btn-secondary btn-icon fixed left-2 top-2 z-30"><Icon name="menu" size={20} /></button>
      )}
      <nav
        aria-label="Main"
        inert={phone && !drawer}
        className={`sticky top-0 z-40 flex h-screen shrink-0 flex-col p-4 motion-safe:transition-[width] motion-safe:duration-150 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-64 max-md:bg-(--shell) max-md:shadow-xl motion-safe:max-md:transition-transform motion-safe:max-md:duration-200 ${drawer ? "" : "max-md:-translate-x-full"} ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className={`mb-4 flex ${collapsed ? "flex-col items-center gap-2" : "items-center gap-2"}`}>
          <Link href="/my-day" title="Brand Creative Hub" className={`flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-ink ${collapsed ? "justify-center" : ""}`}>
            <Logo size={32} />
            {!collapsed && <span className="truncate">Brand Creative Hub</span>}
          </Link>
          {toggleBtn}
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          title="Search (⌘K)"
          className={`btn btn-md btn-secondary mb-4 w-full font-normal text-n-700 ${collapsed ? "!px-0" : ""}`}
        >
          <Icon name="search" size={16} />
          {!collapsed && (<><span className="flex-1 text-left">Search</span><kbd className="text-xs">⌘K</kbd></>)}
        </button>

        {!collapsed && (
          <button onClick={toggleWork} aria-expanded={workOpen} className="mb-2 flex w-full items-center gap-2 rounded-tight px-4 py-2 text-n-700 hover:bg-white/60 eyebrow">
            <span className="flex-1 text-left">Workspace</span>
            <span className={workOpen ? "" : "-rotate-90"}><Icon name="chevronDown" size={14} /></span>
          </button>
        )}
        {(collapsed || workOpen) && <div className="flex flex-col">{ITEMS.filter((i) => (!i.forRequesters || !isJira || me?.role === "requester") && (!i.forCreatives || !isJira || me?.role === "creative")).map((i) => navLink(i, i.href === "/blocking" ? waiting : undefined))}</div>}

        {/* Brand Assets and Favorites folders share one scrolling area so a short window never pushes into the user row */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {/* Brand Assets folder */}
        <div>
          {collapsed ? (
            <Link href="/brand" title="Brand Assets" aria-label="Brand Assets" aria-current={pathname.startsWith("/brand") ? "page" : undefined} className={row(pathname.startsWith("/brand"))}>
              <Icon name="palette" size={18} />
            </Link>
          ) : (
            <section aria-label="Brand Assets">
              <button onClick={toggleBrand} aria-expanded={brandOpen} className="flex w-full items-center gap-2 rounded-tight px-4 py-2 text-n-700 hover:bg-white/60 eyebrow">
                <Icon name="palette" size={14} />
                <span className="flex-1 text-left">Brand Assets</span>
                <span className={brandOpen ? "" : "-rotate-90"}><Icon name="chevronDown" size={14} /></span>
              </button>
              {brandOpen && (
                <ul>
                  {BRAND_ITEMS.map((b) => {
                    const on = pathname === b.href || pathname.startsWith(`${b.href}/`);
                    return (
                      <li key={b.href}>
                        <Link href={b.href} aria-current={on ? "page" : undefined} className={row(on)}>{b.icon === "goldie"
                          ? <span aria-hidden className="inline-block h-[18px] w-[18px] bg-current" style={{ WebkitMask: "url(/library/logos/surveymonkey/logomark-black.svg) center / contain no-repeat", mask: "url(/library/logos/surveymonkey/logomark-black.svg) center / contain no-repeat" }} />
                          : <Icon name={b.icon} size={18} />}<span className="flex-1">{b.label}</span></Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Favorites folder */}
        <div className="mt-2">
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

        </div>

        {/* Bottom: utilities between two rules, then you */}
        <div className="border-t border-line pt-2">
          {(!isJira || me?.role === "creative") && navLink(ANALYTICS_ITEM)}
          {(me?.isAdmin || me?.role === "creative") && navLink(ADMIN_ITEM)}
          <button onClick={() => setHelpOpen(true)} data-tour="help" title="Help" aria-label="Help" aria-haspopup="dialog" className={`w-full ${row(false)}`}>
            <Icon name="help" size={18} />
            {!collapsed && <span className="flex-1 text-left">Help</span>}
          </button>
        </div>
        <div className={`mt-2 flex gap-2 border-t border-line pt-2 ${collapsed ? "flex-col items-center" : "items-center"}`}>
          <UserMenu me={me} user={user} collapsed={collapsed} />
          <NotificationBell waiting={waiting} collapsed={collapsed} ready={!isJira || !!me} />
        </div>
      </nav>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </>
  );
}
