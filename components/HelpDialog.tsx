"use client";

import { useEffect, useRef } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { HELP } from "@/lib/help";

export const START_TOUR = "start-tour";

function Row({ icon, title, body, action }: { icon: IconName; title: string; body: string; action: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-loose border border-line p-4">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-round bg-n-150 text-n-800"><Icon name={icon} size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
      {action}
    </li>
  );
}

/** Help: how to reach the team, where the docs live, and a replayable walkthrough of the site. */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-loose border border-line bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="help-title" className="text-xl font-bold">Help</h2>
            <p className="mt-2 text-sm text-muted">The Brand Creative team is happy to help. Ask {HELP.contacts.join(" or ")}, or start with {HELP.slackChannel}.</p>
          </div>
          <button ref={first} onClick={onClose} aria-label="Close" className="btn btn-ghost btn-icon"><Icon name="close" size={18} /></button>
        </div>
        <ul className="mt-6 space-y-4">
          <Row
            icon="play" title="Take the tour" body="A two-minute walkthrough: where to start a project, track it, give feedback and clear blockers."
            action={<button onClick={() => { onClose(); window.dispatchEvent(new Event(START_TOUR)); }} className="btn btn-md btn-primary">Start tour</button>}
          />
          <Row
            icon="hash" title={`Ask in ${HELP.slackChannel}`} body="Quick questions, status checks and anything that is stuck."
            action={<a href={HELP.slackUrl} target="_blank" rel="noreferrer" className="btn btn-md btn-secondary">Open Slack <Icon name="externalLink" size={14} /></a>}
          />
          <Row
            icon="bookOpen" title="Read the guide" body={`${HELP.confluenceLabel}, in Confluence.`}
            action={<a href={HELP.confluenceUrl} target="_blank" rel="noreferrer" className="btn btn-md btn-secondary">Open Confluence <Icon name="externalLink" size={14} /></a>}
          />
        </ul>
      </div>
    </div>
  );
}
