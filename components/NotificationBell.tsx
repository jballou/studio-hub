"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { notificationsRepo, type Inbox } from "@/lib/data";
import { relativeTime } from "@/lib/myday/plan";
import type { AppNotification } from "@/lib/types";

const EMPTY: Inbox = { items: [], unread: 0 };

function message(n: AppNotification): { who: string; what: string } {
  const many = (n.count ?? 1) > 1;
  switch (n.kind) {
    case "review-request": return { who: n.fromName, what: many ? `asked for your feedback on a batch of ${n.count}: “${n.assetName}”` : `asked for your feedback on “${n.assetName}”` };
    case "new-version": return { who: n.fromName, what: many ? `uploaded new versions in “${n.assetName}” (${n.count})` : `uploaded a new version of “${n.assetName}”` };
    case "added": return { who: n.fromName, what: `added you to “${n.assetName}”` };
    case "approved": return { who: n.fromName, what: `approved “${n.assetName}”` };
    case "changes": return { who: n.fromName, what: `asked for changes on “${n.assetName}”` };
  }
}

/** The sidebar bell: unread review requests and updates, plus a pointer to tickets waiting on you. */
export function NotificationBell({ waiting, collapsed, ready }: { waiting: number; collapsed: boolean; ready: boolean }) {
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox>(EMPTY);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => { notificationsRepo.list().then(setInbox).catch(() => {}); }, []);
  useEffect(() => {
    if (!ready) return;
    refresh();
    window.addEventListener("notifications-changed", refresh);
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("notifications-changed", refresh); clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [ready, refresh]);

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  const badge = inbox.unread + waiting;
  const go = async (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) setInbox((cur) => ({ items: cur.items.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)), unread: Math.max(0, cur.unread - 1) }));
    void notificationsRepo.markRead([n.id]).catch(() => {});
    router.push(`/review/${n.assetId}`);
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog" aria-expanded={open}
        aria-label={badge > 0 ? `Notifications: ${badge} new` : "Notifications"}
        title={badge > 0 ? `${badge} new` : "Notifications"}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-tight text-n-800 hover:bg-white/60"
      >
        <Icon name="bell" size={18} />
        {badge > 0 && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-round bg-bad-fg" />}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className={`absolute z-50 w-80 rounded-loose border border-line bg-white shadow-xl ${collapsed ? "bottom-0 left-full ml-4" : "bottom-full left-0 mb-2"}`}>
          <div className="flex items-center border-b border-line px-4 py-4">
            <h2 className="text-sm font-bold">Notifications</h2>
            {inbox.unread > 0 && <button onClick={() => { void notificationsRepo.markRead().then(setInbox).catch(() => {}); }} className="ml-auto text-xs font-medium text-brand hover:underline">Mark all read</button>}
          </div>
          {waiting > 0 && (
            <Link href="/blocking" onClick={() => setOpen(false)} className="flex items-center gap-4 border-b border-line bg-bad-bg px-4 py-4 text-sm hover:opacity-90">
              <Icon name="ban" size={16} />
              <span className="flex-1 font-medium text-bad-fg">{waiting} {waiting === 1 ? "project is" : "projects are"} waiting on you</span>
              <Icon name="chevronRight" size={14} />
            </Link>
          )}
          {inbox.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {inbox.items.map((n) => {
                const m = message(n);
                return (
                  <li key={n.id}>
                    <button onClick={() => go(n)} className={`flex w-full items-start gap-4 border-b border-line px-4 py-4 text-left last:border-b-0 hover:bg-n-150 ${n.readAt ? "" : "bg-brand-soft/40"}`}>
                      <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-round ${n.readAt ? "bg-transparent" : "bg-brand"}`} />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-bold">{m.who}</span> {m.what}
                        <span className="mt-0 block text-xs text-muted">{n.projectKey} · {relativeTime(n.createdAt)}{n.readAt ? "" : " · New"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
