"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { projectsRepo, repo } from "@/lib/data";

type Hit = { id: string; title: string; sub: string; href: string };

/** Quick jump across projects and designs. Full search (comments, filters) is a later screen. */
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [designs, setDesigns] = useState<Hit[]>([]);
  const [found, setFound] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    repo.listAssets().then((assets) => setDesigns(assets.map((a) => ({ id: a.id, title: a.name, sub: `Design · ${a.projectKey}`, href: `/review/${a.id}` }))));
  }, []);

  // Projects are looked up as you type (after a short pause, from two letters), never as a whole list on open: opening
  // search shouldn't cost a Jira call, and each lookup is cached on the server.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      projectsRepo.searchProjects("u-avery", t, 8).then((ps) => {
        if (live) setFound(ps.map((p) => ({ id: p.id, title: p.title, sub: `Project · ${p.jiraKey}`, href: `/projects/${p.jiraKey}` })));
      }).catch(() => { if (live) setFound([]); });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [q]);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    const mine = t ? designs.filter((h) => `${h.title} ${h.sub}`.toLowerCase().includes(t)) : designs;
    return [...(t.length >= 2 ? found : []), ...mine].slice(0, 8);
  }, [q, designs, found]);

  const go = (h?: Hit) => {
    if (!h) return;
    onClose();
    router.push(h.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-n-1000/40 p-4 pt-[15vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") go(hits[active]);
        }}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search projects and designs"
            aria-label="Search projects and designs"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border border-line px-1.5 text-xs text-muted">esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {hits.length === 0 && <li className="p-4 text-center text-sm text-muted">No matches.</li>}
          {hits.map((h, i) => (
            <li key={`${h.href}-${h.id}`}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left ${i === active ? "bg-brand-soft" : ""}`}
              >
                <span className="text-sm font-medium">{h.title}</span>
                <span className="text-xs text-muted">{h.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
