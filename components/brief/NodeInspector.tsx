"use client";

import { Icon } from "@/components/ui/Icon";
import { moveRule, renameField, updateNode } from "@/lib/brief/edit";
import { OP_LABEL, QTYPE_LABEL, RESERVED_FIELDS, optionsOf, type Branch, type Flow, type Op, type QNode, type QType } from "@/lib/brief/flow";

const input = "w-full rounded-lg border border-control bg-white px-3 py-1.5 text-sm";
const lbl = "block text-xs font-semibold";
const snippet = (n: QNode) => `${n.label || n.prompt.slice(0, 28) || n.id}`;

/** Edit one question: its wording, answer type, options, and where it leads. */
export function NodeInspector({
  flow, node, onFlow, onAddAfter, onDelete,
}: {
  flow: Flow;
  node: QNode;
  onFlow: (f: Flow) => void;
  onAddAfter: () => void;
  onDelete: () => void;
}) {
  const set = (patch: Partial<QNode>) => onFlow(updateNode(flow, node.id, patch));
  const others = flow.nodes.filter((n) => n.id !== node.id);
  const isType = node.field === "type";
  const hasOptions = node.qtype === "choice" || node.qtype === "multichoice";
  const options = node.options ?? [];
  const branches = node.branches ?? [];

  const setBranch = (i: number, patch: Partial<Branch> | { when: Partial<Branch["when"]> }) => {
    const next = branches.map((b, j) => (j === i ? { ...b, ...("when" in patch && patch.when ? { when: { ...b.when, ...patch.when } } : patch) } : b));
    set({ branches: next as Branch[] });
  };

  const changeType = (qtype: QType) => {
    const patch: Partial<QNode> = { qtype };
    if ((qtype === "choice" || qtype === "multichoice") && options.length < 2) patch.options = [{ id: "option_1", label: "Option 1" }, { id: "option_2", label: "Option 2" }];
    set(patch);
  };

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-3">
        <label className={lbl}>What the assistant asks
          <textarea rows={3} value={node.prompt} onChange={(e) => set({ prompt: e.target.value })} className={`${input} mt-1 font-normal`} placeholder="e.g. When do you need “{{title}}” by?" />
          <span className="mt-1 block text-[11px] font-normal text-muted">Use {"{{key}}"} to mention an earlier answer, like {"{{title}}"}.</span>
        </label>
        <label className={lbl}>Short heading
          <input value={node.label} onChange={(e) => set({ label: e.target.value })} className={`${input} mt-1 font-normal`} />
          <span className="mt-1 block text-[11px] font-normal text-muted">Shown in the summary and the Jira description.</span>
        </label>
        <label className={lbl}>Helper text (optional)
          <input value={node.help ?? ""} onChange={(e) => set({ help: e.target.value || undefined })} className={`${input} mt-1 font-normal`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={lbl}>Answer type
            <select value={node.qtype} onChange={(e) => changeType(e.target.value as QType)} className={`${input} mt-1 font-normal`}>
              {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-sm font-medium">
            <input type="checkbox" checked={node.required} onChange={(e) => set({ required: e.target.checked })} /> Required
          </label>
        </div>
        {(node.qtype === "text" || node.qtype === "longtext") && (
          <label className={lbl}>Placeholder (optional)
            <input value={node.placeholder ?? ""} onChange={(e) => set({ placeholder: e.target.value || undefined })} className={`${input} mt-1 font-normal`} />
          </label>
        )}
      </section>

      {hasOptions && (
        <section>
          <h3 className="mb-1 text-xs font-semibold">Options</h3>
          <ul className="space-y-1.5">
            {options.map((o, i) => (
              <li key={o.id} className="space-y-1">
                <div className="flex gap-1">
                  <input aria-label={`Option ${i + 1}`} value={o.label} onChange={(e) => set({ options: options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className={input} />
                  <button type="button" aria-label="Move option up" disabled={i === 0} onClick={() => { const c = [...options]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; set({ options: c }); }} className="rounded-lg border border-control px-2 disabled:opacity-30"><span className="inline-block -rotate-90"><Icon name="chevronRight" size={12} /></span></button>
                  <button type="button" aria-label="Move option down" disabled={i === options.length - 1} onClick={() => { const c = [...options]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; set({ options: c }); }} className="rounded-lg border border-control px-2 disabled:opacity-30"><span className="inline-block rotate-90"><Icon name="chevronRight" size={12} /></span></button>
                  <button type="button" aria-label={`Remove option ${o.label}`} onClick={() => set({ options: options.filter((_, j) => j !== i) })} className="rounded-lg border border-control px-2 text-bad-fg"><Icon name="x" size={12} /></button>
                </div>
                {isType && (
                  <input aria-label={`Jira issue type id for ${o.label}`} value={o.jiraIssueTypeId ?? ""} onChange={(e) => set({ options: options.map((x, j) => (j === i ? { ...x, jiraIssueTypeId: e.target.value.trim() || undefined } : x)) })} placeholder="Jira issue type ID (e.g. 18868)" className={`${input} font-mono text-xs`} />
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { let id = `option_${options.length + 1}`; while (options.some((o) => o.id === id)) id += "_"; set({ options: [...options, { id, label: `Option ${options.length + 1}` }] }); }} className="mt-2 text-xs font-medium text-brand hover:underline">+ Add option</button>
        </section>
      )}

      <section className="space-y-3 rounded-xl bg-n-150 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-n-800">Where it goes next</h3>
        <label className={lbl}>Usually ask
          <select value={node.next ?? ""} onChange={(e) => set({ next: e.target.value || null })} className={`${input} mt-1 font-normal`}>
            <option value="">Nothing. Finish and show the summary</option>
            {others.map((n) => <option key={n.id} value={n.id}>{snippet(n)}</option>)}
          </select>
        </label>

        <div>
          <p className="mb-1 text-xs font-semibold">But first, check these rules</p>
          {branches.length === 0 && <p className="text-xs text-muted">No rules. Everyone gets the question above.</p>}
          <ol className="space-y-2">
            {branches.map((b, i) => {
              const target = flow.nodes.find((n) => n.field === b.when.field);
              const needsValue = b.when.op !== "notEmpty" && b.when.op !== "empty";
              const choices = target ? optionsOf(target) : [];
              return (
                <li key={i} className="space-y-1.5 rounded-lg border border-line bg-white p-2">
                  <div className="flex items-center gap-1 text-xs"><span className="font-semibold">If</span>
                    <select aria-label="Rule: question" value={b.when.field} onChange={(e) => setBranch(i, { when: { field: e.target.value, value: undefined } })} className={`${input} !py-1`}>
                      {!target && <option value={b.when.field}>{b.when.field} (missing)</option>}
                      {flow.nodes.map((n) => <option key={n.id} value={n.field}>{snippet(n)}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <select aria-label="Rule: comparison" value={b.when.op} onChange={(e) => setBranch(i, { when: { op: e.target.value as Op } })} className={`${input} !py-1 text-xs`}>
                      {(Object.keys(OP_LABEL) as Op[]).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
                    </select>
                    {needsValue && (choices.length ? (
                      <select aria-label="Rule: value" value={b.when.value ?? ""} onChange={(e) => setBranch(i, { when: { value: e.target.value } })} className={`${input} !py-1 text-xs`}>
                        <option value="">Choose…</option>
                        {choices.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input aria-label="Rule: value" value={b.when.value ?? ""} onChange={(e) => setBranch(i, { when: { value: e.target.value } })} className={`${input} !py-1 text-xs`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-xs"><span className="font-semibold">ask</span>
                    <select aria-label="Rule: go to" value={b.goto} onChange={(e) => setBranch(i, { goto: e.target.value })} className={`${input} !py-1`}>
                      {!flow.nodes.some((n) => n.id === b.goto) && <option value={b.goto}>(missing)</option>}
                      {others.map((n) => <option key={n.id} value={n.id}>{snippet(n)}</option>)}
                    </select>
                    <button type="button" aria-label="Move rule up" disabled={i === 0} onClick={() => onFlow(moveRule(flow, node.id, i, i - 1))} className="rounded border border-control px-1.5 py-1 disabled:opacity-30"><span className="inline-block -rotate-90"><Icon name="chevronRight" size={11} /></span></button>
                    <button type="button" aria-label="Move rule down" disabled={i === branches.length - 1} onClick={() => onFlow(moveRule(flow, node.id, i, i + 1))} className="rounded border border-control px-1.5 py-1 disabled:opacity-30"><span className="inline-block rotate-90"><Icon name="chevronRight" size={11} /></span></button>
                    <button type="button" aria-label="Delete rule" onClick={() => set({ branches: branches.filter((_, j) => j !== i) })} className="rounded border border-control px-1.5 py-1 text-bad-fg"><Icon name="x" size={11} /></button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            disabled={others.length === 0}
            onClick={() => set({ branches: [...branches, { when: { field: node.field, op: "equals", value: optionsOf(node)[0]?.id }, goto: node.next ?? others[0].id }] })}
            className="mt-2 text-xs font-medium text-brand hover:underline disabled:opacity-40"
          >
            + Add a rule
          </button>
          <p className="mt-1 text-[11px] text-muted">Rules are checked top to bottom. The first one that matches decides.</p>
        </div>
      </section>

      <section>
        <label className={lbl}>Answer key
          <input value={node.field} onChange={(e) => onFlow(renameField(flow, node.id, e.target.value))} className={`${input} mt-1 font-mono text-xs font-normal`} />
        </label>
        <p className="mt-1 text-[11px] text-muted">
          Rules refer to answers by this key; renaming updates them for you. Special keys the ticket uses:{" "}
          {RESERVED_FIELDS.map((f) => <code key={f} className="mr-1 rounded bg-n-150 px-1">{f}</code>)}
          (request type, title, due date, stakeholders).
        </p>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="button" onClick={onAddAfter} className="rounded-lg border border-control bg-white px-3 py-1.5 text-xs font-medium hover:bg-brand-soft">+ Add question after this</button>
        <p className="basis-full text-[11px] text-muted">New questions go on the &ldquo;usually ask&rdquo; path. Answers that have their own rule keep following it.</p>
        {flow.start !== node.id && <button type="button" onClick={() => onFlow({ ...flow, start: node.id })} className="rounded-lg border border-control bg-white px-3 py-1.5 text-xs font-medium hover:bg-brand-soft">Make this the first question</button>}
        <button type="button" onClick={onDelete} className="ml-auto rounded-lg border border-control bg-white px-3 py-1.5 text-xs font-medium text-bad-fg hover:bg-bad-bg">Delete</button>
      </div>
    </div>
  );
}
