"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { FlagTags } from "@/components/blocks/BlockedTag";
import { Callout, StatusTag, Tag } from "@/components/ui/Tag";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IssueIcon } from "@/components/ui/IssueIcon";
import { StaleNotice } from "@/components/ui/StaleNotice";
import { useMe } from "@/hooks/useMe";
import { isJira, projectsRepo, repo, teamRepo } from "@/lib/data";
import { localDay } from "@/lib/myday/plan";
import { pastDueDays, pastDueWords } from "@/lib/pastdue";
import type { IntakeAction, Person, Project, User } from "@/lib/types";

const ACTIONS: { id: IntakeAction; label: string; icon: IconName }[] = [
  { id: "info", label: "Need more info", icon: "help" },
  { id: "wontdo", label: "Won't do", icon: "ban" },
  { id: "duplicate", label: "Duplicate", icon: "copy" },
];

const daysBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000));
const waitingWords = (d: number) => (d === 0 ? "New today" : d === 1 ? "Waiting 1 day" : `Waiting ${d} days`);
const firstName = (n?: string) => (n ?? "").split(/\s+/)[0] || "the requester";
/** Jira gives the requester's name; the demo gives only an id. */
const requesterOf = (p: Project, users: User[]) => p.requesterName ?? users.find((u) => u.id === p.requesterId)?.name;

type Open = { key: string; action: IntakeAction } | null;
type Notice = { id: number; tone: "ok" | "warn"; text: string };

/** The unassigned queue: every open ticket nobody owns yet, with one-step triage (assign, ask for more information, or close it out). */
export function IntakeView() {
  const me = useMe();
  const [list, setList] = useState<Project[] | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<Open>(null);
  const [note, setNote] = useState("");
  const [dupe, setDupe] = useState("");
  const [rowError, setRowError] = useState<{ key: string; text: string } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try { setList(await projectsRepo.listIntake()); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the queue."); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDay());
    load();
    teamRepo.members().then(setMembers).catch(() => {});
    repo.listUsers().then(setUsers).catch(() => {});
  }, [load]);

  useEffect(() => { if (panel) field.current?.focus(); }, [panel]);

  const announce = (tone: Notice["tone"], text: string) => setNotices((n) => [{ id: ++seq.current, tone, text }, ...n].slice(0, 3));
  const leave = (key: string) => setList((l) => (l ?? []).filter((p) => p.jiraKey !== key));
  const close = () => { setPanel(null); setNote(""); setDupe(""); setRowError(null); };

  const assign = async (p: Project, id: string) => {
    const who = members.find((m) => m.id === id)?.name ?? "them";
    setBusy(p.jiraKey); setRowError(null);
    try {
      await projectsRepo.assign(p.jiraKey, id);
      leave(p.jiraKey);
      announce("ok", `${p.jiraKey} is now ${who}'s.`);
    } catch (e) { setRowError({ key: p.jiraKey, text: e instanceof Error ? e.message : "Couldn't assign it." }); }
    setBusy(null);
  };

  const submit = async (p: Project, action: IntakeAction) => {
    setBusy(p.jiraKey); setRowError(null);
    try {
      const r = await projectsRepo.intakeAction(p.jiraKey, { action, note, duplicateOf: dupe });
      leave(p.jiraKey);
      close();
      announce(r.notes.length ? "warn" : "ok",
        `${p.jiraKey} ${action === "info" ? `sent back to ${firstName(requesterOf(p, users))} (now ${r.status})` : `closed as ${r.status.toLowerCase()}`}.${r.notes.length ? ` ${r.notes.join(" ")}` : ""}`);
    } catch (e) { setRowError({ key: p.jiraKey, text: e instanceof Error ? e.message : "Couldn't do that." }); }
    setBusy(null);
  };

  if (isJira && me && me.role !== "creative") {
    return <main className="page"><PageTitle>Intake</PageTitle><p className="text-sm text-muted">Intake is the creative team&apos;s queue of new tickets. Your own requests are under My briefs.</p></main>;
  }

  const oldest = list && list.length && today ? daysBetween(list[0].submittedAt, today) : 0;
  return (
    <main className="page">
      <PageTitle>Intake</PageTitle>
      <StaleNotice />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <p className="min-w-0 flex-1 text-sm text-muted">
          {list === null ? "Loading…" : list.length === 0 ? "Nothing waiting." : `${list.length} open ${list.length === 1 ? "ticket" : "tickets"} nobody owns yet, oldest first${oldest > 0 ? ` (the oldest has waited ${oldest} ${oldest === 1 ? "day" : "days"})` : ""}. Backlog and On Hold aren't shown.`}
        </p>
        <button onClick={load} className="btn btn-sm btn-secondary"><Icon name="refresh" size={14} />Refresh</button>
      </div>

      <div role="status" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className="mb-2"><Callout tone={n.tone} icon={n.tone === "ok" ? "check" : "alert"}>{n.text}</Callout></div>
        ))}
      </div>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      {list !== null && list.length === 0 && !error && (
        <Callout tone="ok" icon="check">Every open ticket has an owner. New requests will show up here.</Callout>
      )}

      {list && list.length > 0 && (
        <ul className="space-y-2">
          {list.map((p) => {
            const late = today ? pastDueDays(p, today) : null;
            const waited = today ? daysBetween(p.submittedAt, today) : 0;
            const open = panel?.key === p.jiraKey ? panel.action : null;
            const working = busy === p.jiraKey;
            return (
              <li key={p.jiraKey} className="rounded-tight border border-line bg-white">
                <div className="flex flex-wrap items-start gap-4 p-4">
                  <div className="min-w-0 flex-[1_1_20rem]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                      {p.issueType && <IssueIcon level={p.issueType.level} typeName={p.issueType.name} />}
                      <Link href={`/projects/${p.jiraKey}`} className="font-medium hover:underline">{p.title}</Link>
                      <StatusTag project={p} />
                      <FlagTags flag={p.flag} />
                      {late !== null && <Tag tone="bad" icon="alert">Past due · {pastDueWords(late)}</Tag>}
                      {waited >= 7 && <Tag tone="warn" icon="alert">{waitingWords(waited)}</Tag>}
                    </div>
                    <p className="text-xs text-muted">
                      {p.jiraKey} · {p.type} · {requesterOf(p, users) ?? "Unknown requester"} · {waited < 7 && <>{waitingWords(waited)} · </>}{p.deadline ? `Due ${p.deadline}` : "No due date"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Assign ${p.title}`} value="" disabled={working || members.length === 0}
                      onChange={(e) => e.target.value && assign(p, e.target.value)}
                      className="btn btn-sm btn-secondary min-w-40 text-left disabled:opacity-50"
                    >
                      <option value="">{working && !panel ? "Assigning…" : members.length ? "Assign to…" : "No team members yet"}</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    {ACTIONS.map((a) => (
                      <button
                        key={a.id} aria-pressed={open === a.id} aria-label={`${a.label}: ${p.title}`} disabled={working}
                        onClick={() => { if (open === a.id) close(); else { setPanel({ key: p.jiraKey, action: a.id }); setNote(""); setDupe(""); setRowError(null); } }}
                        className="chip px-2"
                      >
                        <Icon name={a.icon} size={14} />{a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {open && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); submit(p, open); }}
                    onKeyDown={(e) => { if (e.key === "Escape") close(); }}
                    className="mx-4 mb-4 rounded-tight bg-n-100 p-4"
                    aria-label={`${ACTIONS.find((a) => a.id === open)!.label}: ${p.title}`}
                  >
                    {open === "duplicate" && (
                      <label className="mb-2 block text-sm font-bold">Duplicate of
                        <input ref={field as React.Ref<HTMLInputElement>} value={dupe} onChange={(e) => setDupe(e.target.value)} placeholder="MKTGCRTV-123" maxLength={20}
                          className="mt-2 block h-10 w-full max-w-xs rounded-tight border border-control bg-white px-4 text-sm font-normal" />
                      </label>
                    )}
                    <label className="block text-sm font-bold">
                      {open === "info" ? `What do you need from ${firstName(requesterOf(p, users))}?` : open === "wontdo" ? "Why not? (optional)" : "Note (optional)"}
                      <textarea
                        ref={open === "duplicate" ? undefined : (field as React.Ref<HTMLTextAreaElement>)} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1500} required={open === "info"}
                        placeholder={open === "info" ? "Who is it for, which sizes, when is it needed…" : "Added to the ticket as a comment."}
                        className="mt-2 block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm font-normal"
                      />
                    </label>
                    <p className="mt-2 text-xs text-muted">
                      {open === "info" ? `Moves it to Need more info and @mentions ${firstName(requesterOf(p, users))} in a Jira comment, so they're notified.`
                        : open === "wontdo" ? "Closes it as Won't Do and adds your note as a comment."
                        : "Closes it as Duplicate, links the two tickets and adds a comment."}
                    </p>
                    {rowError?.key === p.jiraKey && <div role="alert" className="mt-4"><Callout tone="bad" icon="alert">{rowError.text}</Callout></div>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="submit" disabled={working} className="btn btn-md btn-primary">
                        {working ? "Working…" : open === "info" ? `Send back to ${firstName(requesterOf(p, users))}` : open === "wontdo" ? "Close as won't do" : "Close as duplicate"}
                      </button>
                      <button type="button" onClick={close} className="btn btn-md btn-ghost">Cancel</button>
                    </div>
                  </form>
                )}
                {!open && rowError?.key === p.jiraKey && <div role="alert" className="mx-4 mb-4"><Callout tone="bad" icon="alert">{rowError.text}</Callout></div>}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
