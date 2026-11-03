"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/review/Avatar";
import { Tag } from "@/components/ui/Tag";
import { isJira } from "@/lib/data";
import type { Me } from "@/hooks/useMe";
import type { User } from "@/lib/types";
import { ThemeToggle } from "./ThemeToggle";

const PROFILE_URL = "https://id.atlassian.com/manage-profile/profile-and-visibility";

/** Your name as a slim button. It opens a small menu: who you are, profile, notification and account settings, appearance, log out. */
export function UserMenu({ me, user, collapsed }: { me: Me | null; user?: User; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  const roleLabel = me ? (me.isAdmin ? "Admin" : me.role === "creative" ? "Creative team" : "Requester") : "";
  const rowCls = "flex w-full items-center gap-4 rounded-tight px-4 py-2 text-left text-sm font-medium hover:bg-n-150";
  
  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open}
        aria-label={user ? `Account menu for ${user.name}` : "Account menu"}
        title={user?.name}
        className={`flex w-full items-center gap-4 rounded-tight p-2 text-left hover:bg-white/60 ${collapsed ? "justify-center" : ""}`}
      >
        <Avatar user={user} size={32} />
        {!collapsed && <span className="min-w-0 flex-1 truncate font-bold text-ink">{user?.name ?? ""}</span>}
      </button>

      {open && (
        <div role="menu" aria-label="Account" className={`absolute z-50 w-80 rounded-loose border border-line bg-white p-2 shadow-xl ${collapsed ? "bottom-0 left-full ml-4" : "bottom-full left-0 mb-2"}`}>
          <div className="flex items-center gap-4 p-4">
            <Avatar user={user} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{user?.name}</p>
              <p className="truncate text-xs text-muted">{me?.email ?? "Demo account"}</p>
              {roleLabel && <div className="mt-2"><Tag tone="neutral">{roleLabel}</Tag></div>}
            </div>
          </div>
          <div className="my-2 border-t border-line" role="separator" />
          <a href={PROFILE_URL} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpen(false)} className={rowCls}><Icon name="pencil" size={18} /> <span className="flex-1">Edit profile</span><Icon name="externalLink" size={14} /></a>
          <Link href="/account#notifications" role="menuitem" onClick={() => setOpen(false)} className={rowCls}><Icon name="bell" size={18} /> Notification settings</Link>
          <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className={rowCls}><Icon name="userRound" size={18} /> Account management</Link>
          <div className="my-2 border-t border-line" role="separator" />
          <div className="flex items-center gap-4 px-4 py-2 text-sm font-medium">
            <span className="flex-1">Appearance and sounds</span>
            <ThemeToggle />
          </div>
          {isJira && (
            <>
              <div className="my-2 border-t border-line" role="separator" />
              <button role="menuitem" onClick={() => signOut({ callbackUrl: "/signin" })} className={rowCls}><Icon name="logOut" size={18} /> Log out</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
