"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Tag, UnreadDot } from "@/components/ui/Tag";
import type { Thread, User } from "@/lib/types";
import { Avatar } from "./Avatar";
import { formatTime } from "./VideoViewer";

export type Tab = "all" | "open" | "resolved";

export type Draft = {
  hasPin: boolean;
  /** time captured when the comment was started (video only) */
  capturedMs: number | null;
};

function Mentions({ text, users }: { text: string; users: User[] }) {
  if (!users.length) return <>{text}</>;
  const names = users.map((u) => u.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(@(?:${names.join("|")}))`, "g"));
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") && users.some((u) => `@${u.name}` === p)
          ? <span key={i} className="rounded bg-brand-soft px-0.5 font-medium text-ink">{p}</span>
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

function ThreadCard({
  thread, users, me, selected, unread, canResolve, canPush, onSelect, onReply, onStatus, onPush,
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
  onStatus: (s: Thread["status"]) => void;
  onPush: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
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
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 font-bold text-n-50" title="Pin number on the design">
            {thread.number}
          </span>
        )}
        {where && <span className="font-medium text-brand">{where}</span>}
        <span>{ago(first.createdAt)}</span>
        {thread.jira && <span className="ml-auto"><Tag tone="ok" icon="check" title={`Pushed ${ago(thread.jira.pushedAt)}`}>In Jira</Tag></span>}
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-snug"><Mentions text={first.body} users={users} /></p>

      {replies.length > 0 && (
        <ul className="mt-3 space-y-3 border-l-2 border-line pl-3">
          {replies.map((c) => (
            <li key={c.id}>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar user={byId(c.authorId)} size={20} />
                <span className="font-semibold text-ink">{byId(c.authorId)?.name ?? "Unknown"}</span>
                <span>{ago(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words"><Mentions text={c.body} users={users} /></p>
            </li>
          ))}
        </ul>
      )}

      {thread.pushError && (
        <div role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg border border-bad-line bg-bad-bg px-2 py-1.5 text-xs text-bad-fg">
          <Icon name="close" size={14} />
          <span><strong>Not pushed to Jira.</strong> {thread.pushError}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
        <button className="flex items-center gap-1 font-medium text-ink hover:underline" onClick={() => setReplying((r) => !r)}>
          <Icon name="reply" size={13} /> Reply
        </button>
        {canPush && !thread.jira && (
          <button className="ml-auto font-medium text-brand hover:underline" onClick={onPush}>
            {thread.pushError ? "Retry push to Jira" : "Push to Jira"}
          </button>
        )}
      </div>

      {replying && (
        <form
          className="mt-3 flex gap-2"
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
            className="min-w-0 flex-1 rounded-lg border border-control px-3 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-n-50 hover:bg-brand-dark">Send</button>
        </form>
      )}
    </div>
  );
}

export function CommentList({
  threads, counts, users, me, selectedId, unreadIds, tab, mine, unpushed, canResolve, canPush,
  onTab, onMine, onUnpushed, onSelect, onReply, onStatus, onPush, onPushAll,
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
  onStatus: (id: string, s: Thread["status"]) => void;
  onPush: (id: string) => void;
  onPushAll: () => void;
}) {
  const anyPushable = threads.some((t) => !t.jira && canPush(t));
  const pill = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => onTab(t)}
      aria-pressed={tab === t}
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? "bg-brand-soft text-ink" : "bg-n-150 text-n-800 hover:bg-n-200"}`}
    >
      {label} <span className="text-xs text-muted">{counts[t]}</span>
    </button>
  );

  return (
    <aside className="flex w-[420px] shrink-0 flex-col">
      <div className="space-y-2 p-4 pb-2">
        <div className="flex gap-2">{pill("all", "All")}{pill("open", "Open")}{pill("resolved", "Resolved")}</div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <label className="flex items-center gap-1"><input type="checkbox" checked={mine} onChange={(e) => onMine(e.target.checked)} /> Only mine</label>
          {me.role === "creative" && (
            <>
              <label className="flex items-center gap-1"><input type="checkbox" checked={unpushed} onChange={(e) => onUnpushed(e.target.checked)} /> Not in Jira</label>
              <button disabled={!anyPushable} onClick={onPushAll} className="ml-auto font-medium text-brand enabled:hover:underline disabled:opacity-40">
                Push all to Jira
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 pt-2">
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
            onStatus={(s) => onStatus(t.id, s)}
            onPush={() => onPush(t.id)}
          />
        ))}
      </div>
    </aside>
  );
}

export function Composer({
  users, me, isVideo, draft, hasPdfPage, onStart, onClearPin, onSubmit,
}: {
  users: User[];
  me: User;
  isVideo: boolean;
  draft: Draft | null;
  hasPdfPage: number | null;
  onStart: () => void;
  onClearPin: () => void;
  onSubmit: (body: string, withTime: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [withTime, setWithTime] = useState(true);
  const area = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const expanded = focused || !!body || !!draft?.hasPin;

  // Dropping a pin should lead straight into typing.
  const pinned = draft?.hasPin ?? false;
  useEffect(() => {
    if (pinned) area.current?.focus();
  }, [pinned]);

  const mentionQuery = /@([\w ]*)$/.exec(body)?.[1];
  const suggestions = mentionQuery === undefined
    ? []
    : users.filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== me.id).slice(0, 5);

  const insertMention = (u: User) => {
    setBody((b) => b.replace(/@([\w ]*)$/, `@${u.name} `));
    area.current?.focus();
  };

  const submit = () => {
    if (!body.trim()) return;
    onSubmit(body.trim(), isVideo && withTime);
    setBody("");
  };

  return (
    <div
      className="relative mx-auto w-full max-w-2xl rounded-xl border border-line bg-white p-3 shadow-md"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
    >
      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-line bg-white shadow">
          {suggestions.map((u) => (
            <li key={u.id}>
              <button className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-soft" onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}>
                <Avatar user={u} size={20} /> {u.name}
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
        placeholder={isVideo ? "Write a comment… (click the video to pin a spot)" : "Write a comment… (click the design to pin a spot)"}
        aria-label="Write a comment"
        className="w-full resize-none bg-transparent px-1 text-[15px] outline-none placeholder:text-n-650"
      />
      <div className={`mt-2 flex-wrap items-center gap-3 text-xs ${expanded ? "flex" : "hidden"}`}>
        <button
          type="button"
          onClick={() => { setBody((b) => `${b}@`); area.current?.focus(); }}
          aria-label="Mention someone"
          title="Mention someone"
          className="flex h-7 w-7 items-center justify-center rounded text-n-800 hover:bg-brand-soft"
        >
          <Icon name="at" size={16} />
        </button>
        {draft?.hasPin ? (
          <span className="flex items-center gap-1">
            <Tag tone="ok" icon="check">Pinned on design</Tag>
            <button onClick={onClearPin} className="text-muted hover:underline">Remove</button>
          </span>
        ) : (
          <span className="text-muted">
            {isVideo ? "Tip: click the video to pin a spot" : hasPdfPage ? `Commenting on page ${hasPdfPage}. Click to pin a spot` : "Tip: click the design to pin a spot"}
          </span>
        )}
        {isVideo && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} />
            At <span className="font-mono">{formatTime(draft?.capturedMs ?? 0)}</span>
          </label>
        )}
        <button
          onClick={submit}
          disabled={!body.trim()}
          className="ml-auto rounded-lg bg-brand px-5 py-1.5 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:bg-n-200 disabled:text-n-650"
        >
          Send
        </button>
      </div>
    </div>
  );
}
