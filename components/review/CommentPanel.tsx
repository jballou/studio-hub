"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "@/components/ui/Menu";
import { Icon } from "@/components/ui/Icon";
import { Tag, UnreadDot } from "@/components/ui/Tag";
import { knownPeople, peopleRepo } from "@/lib/data/people";
import type { Person, Severity, Thread, User } from "@/lib/types";
import { Avatar } from "./Avatar";
import { SeverityBadge, SeverityPicker } from "./Severity";
import { formatTime, parseTimecode } from "@/lib/timecode";

export type Tab = "all" | "open" | "resolved";

export type Draft = {
  hasPin: boolean;
  /** time captured when the comment was started (video only) */
  capturedMs: number | null;
};

function Mentions({ text, users }: { text: string; users: User[] }) {
  if (!users.length) return <>{text}</>;
  const all = [...users, ...knownPeople()];
  const names = [...new Set(all.map((u) => u.name))].filter(Boolean).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(@(?:${names.join("|")}))`, "g"));
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") && all.some((u) => `@${u.name}` === p)
          ? <span key={i} className="rounded bg-brand-soft px-0 font-medium text-ink">{p}</span>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

function EditForm({ initial, severity: sev0, onSave, onCancel }: { initial: string; severity: Severity | undefined; onSave: (body: string, severity: Severity | undefined) => void; onCancel: () => void }) {
  const [body, setBody] = useState(initial);
  const [sev, setSev] = useState<Severity | undefined>(sev0);
  const save = () => { if (body.trim()) onSave(body.trim(), sev); };
  return (
    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus value={body} rows={3} onChange={(e) => setBody(e.target.value)} aria-label="Edit comment"
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
        className="w-full resize-none rounded-lg border border-control px-4 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SeverityPicker value={sev} onChange={setSev} />
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="btn btn-md btn-secondary">Cancel</button>
          <button onClick={save} disabled={!body.trim()} className="btn btn-md btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}

function ThreadCard({
  thread, users, me, selected, unread, canResolve, canPush, onSelect, onReply, onEdit, onStatus, onPush,
}: {
  thread: Thread;
  users: User[];
  me: User;
  selected: boolean;
  unread: boolean;
  canResolve: boolean;
  canPush: boolean;
  onSelect: () => void;
  onReply: (body: string) => void;
  onEdit: (commentId: string, body: string, severity: Severity | undefined) => void;
  onStatus: (s: Thread["status"]) => void;
  onPush: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const byId = (id: string) => users.find((u) => u.id === id);
  const resolved = thread.status === "resolved";
  const [first, ...replies] = thread.comments;
  const author = byId(first.authorId);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const where = thread.timeMs != null ? formatTime(thread.timeMs) : thread.page != null ? `Page ${thread.page}` : null;

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border bg-white p-4 text-sm shadow-sm ${selected ? "border-brand" : "border-line"} ${resolved ? "opacity-75" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Avatar user={author} />
        <span className="font-semibold">{author?.name ?? "Unknown"}</span>
        {unread && <UnreadDot />}
        {first.severity !== undefined && <SeverityBadge level={first.severity} />}
        <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
          {canResolve ? (
            <button
              onClick={() => onStatus(resolved ? "open" : "resolved")}
              aria-label={resolved ? "Reopen comment" : "Resolve comment"}
              title={resolved ? "Resolved. Click to reopen" : "Mark as resolved"}
              className={`flex h-7 w-7 items-center justify-center rounded-full ${resolved ? "bg-brand text-n-50" : "text-n-700 hover:bg-brand-soft"}`}
            >
              <Icon name={resolved ? "check" : "delivered"} size={resolved ? 14 : 18} />
            </button>
          ) : resolved ? (
            <Tag tone="neutral" icon="check">Resolved</Tag>
          ) : null}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        {thread.anchor && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-2 font-bold text-n-50" title="Pin number on the design">
            {thread.number}
          </span>
        )}
        {where && <span className="font-medium text-brand">{where}</span>}
        <span>{ago(first.createdAt)}</span>
        {first.editedAt && <span title={`Edited ${ago(first.editedAt)}`}>· Edited</span>}
        {thread.jira && <span className="ml-auto"><Tag tone="ok" icon="check" title={`Pushed ${ago(thread.jira.pushedAt)}`}>In Jira</Tag></span>}
      </div>

      {editing === first.id
        ? <EditForm initial={first.body} severity={first.severity} onCancel={() => setEditing(null)} onSave={(b, v) => { onEdit(first.id, b, v); setEditing(null); }} />
        : <p className="mt-2 whitespace-pre-wrap break-words text-sm"><Mentions text={first.body} users={users} /></p>}

      {replies.length > 0 && (
        <ul className="mt-4 space-y-4 border-l-2 border-line pl-4">
          {replies.map((c) => (
            <li key={c.id}>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar user={byId(c.authorId)} size={24} />
                <span className="font-semibold text-ink">{byId(c.authorId)?.name ?? "Unknown"}</span>
                <span>{ago(c.createdAt)}</span>
                {c.editedAt && <span title={`Edited ${ago(c.editedAt)}`}>· Edited</span>}
                {c.severity !== undefined && <SeverityBadge level={c.severity} />}
                {c.authorId === me.id && editing !== c.id && (
                  <button onClick={(e) => { e.stopPropagation(); setEditing(c.id); }} className="ml-auto font-medium text-ink hover:underline">Edit</button>
                )}
              </div>
              {editing === c.id
                ? <EditForm initial={c.body} severity={c.severity} onCancel={() => setEditing(null)} onSave={(b, v) => { onEdit(c.id, b, v); setEditing(null); }} />
                : <p className="mt-2 whitespace-pre-wrap break-words"><Mentions text={c.body} users={users} /></p>}
            </li>
          ))}
        </ul>
      )}

      {thread.pushError && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-bad-line bg-bad-bg px-2 py-2 text-xs text-bad-fg">
          <Icon name="close" size={14} />
          <span><strong>Not pushed to Jira.</strong> {thread.pushError}</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs" onClick={(e) => e.stopPropagation()}>
        <button className="flex items-center gap-2 font-medium text-ink hover:underline" onClick={() => setReplying((r) => !r)}>
          <Icon name="reply" size={13} /> Reply
        </button>
        {(first.authorId === me.id || (canPush && !thread.jira)) && (
          <div className="ml-auto"><Menu label="Comment options" size={24} items={[
            ...(first.authorId === me.id ? [{ label: "Edit comment", icon: "edit" as const, onSelect: () => setEditing(first.id) }] : []),
            ...(canPush && !thread.jira ? [{ label: thread.pushError ? "Retry push to Jira" : "Push to Jira", icon: "link" as const, onSelect: onPush }] : []),
          ]} /></div>
        )}
      </div>

      {replying && (
        <form
          className="mt-4 flex gap-2"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onReply(text.trim());
            setText("");
            setReplying(false);
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Reply as ${me.name}`}
            className="min-w-0 flex-1 rounded-lg border border-control px-4 py-2 text-sm"
          />
          <button className="btn btn-md btn-primary">Post</button>
        </form>
      )}
    </div>
  );
}

export function CommentList({
  threads, counts, users, me, selectedId, unreadIds, tab, mine, unpushed, canResolve, canPush,
  onTab, onMine, onUnpushed, onSelect, onReply, onEdit, onStatus, onPush, onPushAll, request, onJumpUnread,
}: {
  threads: Thread[];
  counts: Record<Tab, number>;
  users: User[];
  me: User;
  selectedId: string | null;
  unreadIds: Set<string>;
  tab: Tab;
  mine: boolean;
  unpushed: boolean;
  canResolve: (t: Thread) => boolean;
  canPush: (t: Thread) => boolean;
  onTab: (t: Tab) => void;
  onMine: (v: boolean) => void;
  onUnpushed: (v: boolean) => void;
  onSelect: (t: Thread) => void;
  onReply: (id: string, body: string) => void;
  onEdit: (threadId: string, commentId: string, body: string, severity: Severity | undefined) => void;
  onStatus: (id: string, s: Thread["status"]) => void;
  onPush: (id: string) => void;
  onPushAll: () => void;
  /** the feedback request this design was sent with, shown at the top of the panel */
  request?: { from: string; due?: string; instructions?: string; approvers: string[] } | null;
  onJumpUnread?: () => void;
}) {
  const anyPushable = threads.some((t) => !t.jira && canPush(t));
  const pill = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => onTab(t)}
      aria-pressed={tab === t}
      className="chip"
    >
      {label} <span className="text-xs text-muted">{counts[t]}</span>
    </button>
  );

  return (
    <aside className="flex w-[420px] shrink-0 flex-col">
      <div className="space-y-4 p-4 pb-2">
        {request && (
          <details open className="group rounded-xl border border-line bg-brand-soft/60 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 font-medium">
              <Icon name="feedback" size={16} />
              <span className="min-w-0 flex-1 truncate">{request.from} asked for your feedback{request.due ? ` by ${request.due}` : ""}</span>
              <span className="transition-transform group-open:rotate-90"><Icon name="chevronRight" size={14} /></span>
            </summary>
            <div className="space-y-2 px-4 pb-4 text-n-800">
              {request.instructions && <p className="whitespace-pre-wrap">{request.instructions}</p>}
              {request.approvers.length > 0 && <p className="text-xs text-muted">Approver{request.approvers.length === 1 ? "" : "s"}: {request.approvers.join(", ")}</p>}
            </div>
          </details>
        )}
        <div className="flex items-center gap-2">
          {pill("all", "All")}{pill("open", "Open")}{pill("resolved", "Resolved")}
          <div className="ml-auto flex items-center gap-2">
            {unreadIds.size > 0 && onJumpUnread && (
              <button onClick={onJumpUnread} className="btn btn-sm btn-primary">
                {unreadIds.size} new <Icon name="chevronRight" size={12} />
              </button>
            )}
            <Menu
              label="Comment options"
              items={[
                { label: "Only my comments", checked: mine, onSelect: () => onMine(!mine) },
                ...(me.role === "creative" ? [
                  { label: "Only comments not in Jira", checked: unpushed, onSelect: () => onUnpushed(!unpushed) },
                  { kind: "divider" as const },
                  { label: "Push all to Jira", icon: "link" as const, disabled: !anyPushable, onSelect: onPushAll },
                ] : []),
              ]}
            />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 pt-2">
        {threads.length === 0 && (
          <p className="rounded-xl border border-dashed border-control bg-white/60 p-6 text-center text-sm text-muted">
            No comments yet. Click anywhere on the design, then type your comment.
          </p>
        )}
        {threads.map((t) => (
          <ThreadCard
            key={t.id}
            thread={t}
            users={users}
            me={me}
            selected={t.id === selectedId}
            unread={unreadIds.has(t.id)}
            canResolve={canResolve(t)}
            canPush={canPush(t)}
            onSelect={() => onSelect(t)}
            onReply={(b) => onReply(t.id, b)}
            onEdit={(cid, b, v) => onEdit(t.id, cid, b, v)}
            onStatus={(s) => onStatus(t.id, s)}
            onPush={() => onPush(t.id)}
          />
        ))}
      </div>
    </aside>
  );
}

export function Composer({
  me, isVideo, audio = false, manualTime = false, draft, hasPdfPage, onStart, onClearPin, onSubmit,
}: {
  me: User;
  isVideo: boolean;
  /** Audio has no frame to pin; comments are tied to the time only. */
  audio?: boolean;
  /** The player can't report time (Drive fallback), so the reviewer types it. */
  manualTime?: boolean;
  draft: Draft | null;
  hasPdfPage: number | null;
  onStart: () => void;
  onClearPin: () => void;
  onSubmit: (body: string, withTime: boolean, typedMs?: number | null, severity?: Severity) => void;
}) {
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity | undefined>(undefined);
  const [withTime, setWithTime] = useState(true);
  const [typed, setTyped] = useState("");
  const typedMs = parseTimecode(typed);
  const needsTime = isVideo && manualTime && withTime && typedMs === null;
  const area = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const expanded = focused || !!body || !!draft?.hasPin;

  // Dropping a pin should lead straight into typing.
  const pinned = draft?.hasPin ?? false;
  useEffect(() => {
    if (pinned) area.current?.focus();
  }, [pinned]);

  // @mentions search real people (Jira users when signed in), not a fixed list.
  const mentionQuery = /@([\p{L}\p{N}_ '.-]*)$/u.exec(body)?.[1];
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  useEffect(() => {
    if (mentionQuery === undefined || !mentionQuery.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      peopleRepo.search(mentionQuery, 6).then((r) => { if (live) setSuggestions(r.filter((p) => p.id !== me.id)); }, () => { if (live) setSuggestions([]); });
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [mentionQuery, me.id]);

  const insertMention = (p: Person) => {
    setBody((b) => b.replace(/@([\p{L}\p{N}_ '.-]*)$/u, `@${p.name} `));
    setSuggestions([]);
    area.current?.focus();
  };

  const submit = () => {
    if (!body.trim() || needsTime) return;
    onSubmit(body.trim(), isVideo && withTime, manualTime ? typedMs : undefined, severity);
    setBody("");
    setSeverity(undefined);
    setTyped("");
  };

  return (
    <div
      className="relative mx-auto w-full max-w-2xl rounded-xl border border-line bg-white p-4 shadow-md"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
    >
      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-line bg-white shadow">
          {suggestions.map((u) => (
            <li key={u.id}>
              <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-brand-soft" onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}>
                <Avatar user={{ id: u.id, name: u.name, initials: u.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(), role: "requester" }} size={24} /> {u.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={area}
        value={body}
        rows={expanded ? 3 : 1}
        onFocus={onStart}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder={audio ? "Write a comment… (it's stamped with the time you're listening to)" : isVideo ? "Write a comment… (click the video to pin a spot)" : "Write a comment… (click the design to pin a spot)"}
        aria-label="Write a comment"
        className="w-full resize-none bg-transparent px-2 text-sm outline-none placeholder:text-n-650"
      />
      <div className={`mt-2 flex-wrap items-center gap-4 text-xs ${expanded ? "flex" : "hidden"}`}>
        <button
          type="button"
          onClick={() => { setBody((b) => `${b}@`); area.current?.focus(); }}
          aria-label="Mention someone"
          title="Mention someone"
          className="flex h-7 w-7 items-center justify-center rounded text-n-800 hover:bg-brand-soft"
        >
          <Icon name="at" size={16} />
        </button>
        {audio ? (
          <span className="text-muted">Tip: play to the moment, then comment</span>
        ) : draft?.hasPin ? (
          <span className="flex items-center gap-2">
            <Tag tone="ok" icon="check">Pinned on design</Tag>
            <button onClick={onClearPin} className="text-muted hover:underline">Remove</button>
          </span>
        ) : (
          <span className="text-muted">
            {isVideo ? "Tip: click the video to pin a spot" : hasPdfPage ? `Commenting on page ${hasPdfPage}. Click to pin a spot` : "Tip: click the design to pin a spot"}
          </span>
        )}
        {isVideo && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} aria-label="Attach a timestamp" />
            At{" "}
            {manualTime ? (
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={!withTime}
                inputMode="numeric"
                placeholder="1:23"
                aria-label="Time in the file, like 1:23"
                aria-invalid={needsTime && typed.trim() !== ""}
                className="w-16 rounded border border-control px-2 py-0 font-mono disabled:opacity-40"
              />
            ) : (
              <span className="font-mono">{formatTime(draft?.capturedMs ?? 0)}</span>
            )}
          </label>
        )}
        <SeverityPicker value={severity} onChange={setSeverity} />
        {needsTime && <span className="text-muted">Type the time you&apos;re at, like 1:23, or untick.</span>}
        <button
          onClick={submit}
          disabled={!body.trim() || needsTime}
          className="btn btn-md btn-primary ml-auto"
        >
          Post
        </button>
      </div>
    </div>
  );
}
