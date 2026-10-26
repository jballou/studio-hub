"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Thread, User } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
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
  return `${Math.round(m / 60)}h ago`;
}

function ThreadCard({
  thread, users, me, selected, canResolve, canPush, onSelect, onReply, onStatus, onPush,
}: {
  thread: Thread;
  users: User[];
  me: User;
  selected: boolean;
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

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const anchorLabel = thread.timeMs != null ? formatTime(thread.timeMs) : thread.page != null ? `p. ${thread.page}` : null;

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 text-sm ${selected ? "border-brand bg-brand-soft/40" : "border-line bg-white"} ${resolved ? "opacity-70" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold text-white"
          style={{ background: resolved ? "#686764" : thread.anchor ? "#08794a" : "#464543" }}
        >
          {thread.anchor ? thread.number : "#"}
        </span>
        {!thread.anchor && <span className="text-xs text-muted">General #{thread.number}</span>}
        {anchorLabel && <span className="rounded bg-line px-1.5 py-0.5 font-mono text-xs">{anchorLabel}</span>}
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          {resolved && <Tag tone="neutral" icon="check">Resolved</Tag>}
          {thread.jira && <Tag tone="ok" icon="check" title={`Pushed ${ago(thread.jira.pushedAt)}`}>In Jira</Tag>}
        </span>
      </div>

      <ul className="space-y-2">
        {thread.comments.map((c) => (
          <li key={c.id}>
            <div className="text-xs text-muted">
              <span className="font-semibold text-foreground">{byId(c.authorId)?.name ?? "Unknown"}</span> · {ago(c.createdAt)}
            </div>
            <p className="whitespace-pre-wrap break-words"><Mentions text={c.body} users={users} /></p>
          </li>
        ))}
      </ul>

      {thread.pushError && (
        <div role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg border border-bad-line bg-bad-bg px-2 py-1.5 text-xs text-bad-fg">
          <Icon name="close" size={14} />
          <span><strong>Not pushed.</strong> {thread.pushError}</span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
        <button className="font-medium text-ink hover:underline" onClick={() => setReplying((r) => !r)}>Reply</button>
        {canResolve && (
          <button className="font-medium text-ink hover:underline" onClick={() => onStatus(resolved ? "open" : "resolved")}>
            {resolved ? "Reopen" : "Resolve"}
          </button>
        )}
        {canPush && !thread.jira && (
          <button className="ml-auto rounded border border-control px-2 py-0.5 font-medium hover:bg-brand-soft" onClick={onPush}>
            {thread.pushError ? "Retry push" : "Push to Jira"}
          </button>
        )}
      </div>

      {replying && (
        <form
          className="mt-2 flex gap-2"
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
            className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm"
          />
          <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white hover:bg-brand-dark">Send</button>
        </form>
      )}
    </div>
  );
}

export function CommentPanel({
  threads, allCount, users, me, selectedId, tab, mine, unpushed, isVideo, draft, canComment,
  canResolve, canPush, onTab, onMine, onUnpushed, onSelect, onReply, onStatus, onPush, onPushAll,
  onStartComposer, onClearPin, onSubmit,
}: {
  threads: Thread[];
  allCount: Record<Tab, number>;
  users: User[];
  me: User;
  selectedId: string | null;
  tab: Tab;
  mine: boolean;
  unpushed: boolean;
  isVideo: boolean;
  draft: Draft | null;
  canComment: boolean;
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
  onStartComposer: () => void;
  onClearPin: () => void;
  onSubmit: (body: string, withTime: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [withTime, setWithTime] = useState(true);
  const area = useRef<HTMLTextAreaElement>(null);

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

  const pushable = threads.some((t) => !t.jira && canPush(t));

  const tabBtn = (t: Tab, label: string): ReactNode => (
    <button
      key={t}
      onClick={() => onTab(t)}
      className={`rounded-full px-3 py-1 text-sm ${tab === t ? "bg-brand text-white" : "hover:bg-brand-soft"}`}
    >
      {label} <span className="opacity-70">{allCount[t]}</span>
    </button>
  );

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-white">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex gap-1">{tabBtn("all", "All")}{tabBtn("open", "Open")}{tabBtn("resolved", "Resolved")}</div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={mine} onChange={(e) => onMine(e.target.checked)} /> Mine</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={unpushed} onChange={(e) => onUnpushed(e.target.checked)} /> Unpushed</label>
          <button
            disabled={!pushable}
            onClick={onPushAll}
            className="ml-auto rounded border border-line px-2 py-0.5 font-medium enabled:hover:bg-brand-soft disabled:opacity-40"
          >
            Push all unpushed
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-paper p-3">
        {threads.length === 0 && <p className="py-8 text-center text-sm text-muted">No comments match.</p>}
        {threads.map((t) => (
          <ThreadCard
            key={t.id}
            thread={t}
            users={users}
            me={me}
            selected={t.id === selectedId}
            canResolve={canResolve(t)}
            canPush={canPush(t)}
            onSelect={() => onSelect(t)}
            onReply={(b) => onReply(t.id, b)}
            onStatus={(s) => onStatus(t.id, s)}
            onPush={() => onPush(t.id)}
          />
        ))}
      </div>

      <div className="relative border-t border-line p-3">
        {!canComment ? (
          <p className="text-sm text-muted">You can comment once you are invited to review this asset.</p>
        ) : (
          <>
            {suggestions.length > 0 && (
              <ul className="absolute bottom-full left-3 right-3 mb-1 rounded border border-line bg-white shadow">
                {suggestions.map((u) => (
                  <li key={u.id}>
                    <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-brand-soft" onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}>
                      {u.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {draft?.hasPin && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                <Tag tone="warn" icon="alert">Pin attached</Tag>
                <button className="text-muted hover:underline" onClick={onClearPin}>Remove</button>
              </div>
            )}
            <textarea
              ref={area}
              value={body}
              rows={3}
              onFocus={onStartComposer}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              placeholder="Add a comment. Use @ to mention."
              className="w-full resize-none rounded border border-line p-2 text-sm"
            />
            <div className="mt-2 flex items-center gap-3">
              {isVideo && (
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} />
                  <span className="font-mono">{formatTime(draft?.capturedMs ?? 0)}</span>
                </label>
              )}
              <button onClick={submit} disabled={!body.trim()} className="ml-auto rounded bg-brand px-4 py-1.5 text-sm font-medium text-white enabled:hover:bg-brand-dark disabled:opacity-40">
                Comment
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
