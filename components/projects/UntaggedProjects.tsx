"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KrPicker } from "@/components/brief/KrPicker";
import { PageTitle } from "@/components/PageTitle";
import { Callout } from "@/components/ui/Tag";
import { useMe } from "@/hooks/useMe";
import { useOkr } from "@/hooks/useOkr";
import { projectsRepo } from "@/lib/data";
import type { Project } from "@/lib/types";

/** Open projects with no KR yet, each with a picker that saves straight to the ticket's Jira labels. */
export function UntaggedProjects() {
  const me = useMe();
  const { krs, ready, sample } = useOkr();
  const [list, setList] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!me) return;
    projectsRepo.listProjects(me.id, "all", "open").then((p) => setList(p.filter((x) => !x.krId && !x.krNone))).catch((e: Error) => setError(e.message));
  }, [me]);

  const save = async (p: Project, kr: string) => {
    if (!kr) return;
    setBusy(p.jiraKey);
    setError(null);
    try {
      await projectsRepo.setKr(p.jiraKey, kr);
      setList((cur) => cur?.filter((x) => x.jiraKey !== p.jiraKey) ?? null);
      setDone((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    }
    setBusy(null);
  };

  if (me && me.role !== "creative") return <main className="page [&>*:not(.fixed)]:max-w-3xl"><p className="text-sm text-muted">Only the creative team tags projects.</p></main>;

  return (
    <main className="page [&>*:not(.fixed)]:max-w-3xl">
      <div className="mb-4 flex items-center gap-4">
        <PageTitle>Tag projects with a KR</PageTitle>
        <Link href="/projects" className="ml-auto text-sm font-medium text-muted hover:underline">Back to projects</Link>
      </div>
      <p className="mb-6 text-sm text-muted">Pick the goal each open project supports, or &ldquo;Not tied to a KR&rdquo; for business as usual. It&apos;s saved to the Jira ticket as a label, and reports group work by it.</p>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
      {sample && krs.length > 0 && <div className="mb-4"><Callout tone="warn" icon="alert">Sample goals only. The real OKR Sheet hasn&apos;t been imported yet.</Callout></div>}
      {ready && krs.length === 0 && <Callout tone="warn" icon="alert">No OKRs are synced yet. An admin can sync them in Preferences → OKRs.</Callout>}
      {done > 0 && <div className="mb-4"><Callout tone="ok" icon="check">{done} tagged.</Callout></div>}
      {list && list.length === 0 && krs.length > 0 && <p className="text-sm text-muted">Every open project has a KR. Nice.</p>}
      <ul className="space-y-2">
        {krs.length > 0 && list?.map((p) => (
          <li key={p.jiraKey} className={`card p-4 ${busy === p.jiraKey ? "pointer-events-none opacity-60" : ""}`}>
            <div className="mb-2 flex items-baseline gap-2">
              <Link href={`/projects/${p.jiraKey}`} className="font-medium hover:underline">{p.title}</Link>
              <span className="text-xs text-muted">{p.jiraKey}</span>
            </div>
            <KrPicker id={`kr-${p.jiraKey}`} krs={krs} value="" onChange={(v) => save(p, v)} sample={sample} />
          </li>
        ))}
      </ul>
    </main>
  );
}
