"use client";

import { useEffect, useRef, useState } from "react";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { optionsOf, type AnswerValue, type QNode } from "@/lib/brief/flow";
import type { Person } from "@/lib/types";

const field = "w-full rounded-tight border border-control bg-white px-4 py-4 text-sm";
const primary = "btn btn-md btn-primary";
const ghost = "btn btn-md btn-secondary";

/** One answer control, chosen by question type. Calls onSubmit with the finished answer. */
export function QuestionInput({
  node, initial, submitLabel = "Continue", onSubmit, onCancel,
}: {
  node: QNode;
  initial?: AnswerValue;
  submitLabel?: string;
  onSubmit: (v: AnswerValue) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(typeof initial === "string" ? initial : "");
  const [multi, setMulti] = useState<string[]>(Array.isArray(initial) && node.qtype === "multichoice" ? (initial as string[]) : []);
  const [people, setPeople] = useState<Person[]>(Array.isArray(initial) && node.qtype === "people" ? (initial as Person[]) : []);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: false }); }, [node.id]);

  const options = optionsOf(node);
  const skipEmpty = (): AnswerValue => (node.qtype === "multichoice" || node.qtype === "people" ? [] : "");
  const skip = !node.required && (
    <button type="button" onClick={() => onSubmit(skipEmpty())} className="text-sm font-medium text-muted hover:underline">Skip</button>
  );
  const linkBad = node.qtype === "link" && text.trim() !== "" && !/^https?:\/\/\S+$/i.test(text.trim());

  if (node.qtype === "choice" || node.qtype === "yesno") {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onSubmit(o.id)} className="chip chip-lg" data-on={initial === o.id}>
            {o.label}
          </button>
        ))}
        {skip}
        {onCancel && <button type="button" onClick={onCancel} className={ghost}>Cancel</button>}
      </div>
    );
  }

  if (node.qtype === "multichoice") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const on = multi.includes(o.id);
            return (
              <button key={o.id} type="button" aria-pressed={on} onClick={() => setMulti(on ? multi.filter((x) => x !== o.id) : [...multi, o.id])} className="chip chip-lg">
                {on && "✓ "}{o.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <button type="button" disabled={node.required && multi.length === 0} onClick={() => onSubmit(multi)} className={primary}>{submitLabel}</button>
          {skip}
          {onCancel && <button type="button" onClick={onCancel} className={ghost}>Cancel</button>}
        </div>
      </div>
    );
  }

  if (node.qtype === "people") {
    return (
      <div className="space-y-4">
        <PeoplePicker label="" value={people} onChange={setPeople} placeholder="Search by name" />
        <div className="flex items-center gap-4">
          <button type="button" disabled={node.required && people.length === 0} onClick={() => onSubmit(people)} className={primary}>{submitLabel}</button>
          {skip}
          {onCancel && <button type="button" onClick={onCancel} className={ghost}>Cancel</button>}
        </div>
      </div>
    );
  }

  const done = () => { if (!linkBad && (text.trim() || !node.required)) onSubmit(text.trim()); };
  return (
    <div className="space-y-4">
      {node.qtype === "longtext" ? (
        <textarea
          ref={ref}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); done(); } }}
          placeholder={node.placeholder}
          aria-label={node.prompt}
          className={`${field} resize-y`}
        />
      ) : (
        <input
          ref={ref}
          type={node.qtype === "date" ? "date" : node.qtype === "link" ? "url" : "text"}
          inputMode={node.qtype === "link" ? "url" : undefined}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } }}
          placeholder={node.qtype === "link" ? "https://" : node.placeholder}
          aria-label={node.prompt}
          className={`${field} ${node.qtype === "date" ? "w-56" : ""}`}
        />
      )}
      {linkBad && <p role="alert" className="text-sm text-bad-fg">That doesn&apos;t look like a link. It should start with https://</p>}
      <div className="flex items-center gap-4">
        <button type="button" disabled={linkBad || (node.required && !text.trim())} onClick={done} className={primary}>{submitLabel}</button>
        {skip}
        {onCancel && <button type="button" onClick={onCancel} className={ghost}>Cancel</button>}
        {node.qtype === "longtext" && <span className="ml-auto text-xs text-muted">⌘ Enter to continue</span>}
      </div>
    </div>
  );
}
