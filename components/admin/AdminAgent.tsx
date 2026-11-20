"use client";

import { useRef, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Callout } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";

type Turn = { role: "user" | "assistant"; content: string; steps?: { tool: string; input: unknown }[] };
const EXAMPLES = ["What's the hex for Green 500?", "Which icons do we have for calendars?", "Show me the white SurveyMonkey logomark", "What font do we use?"];

/** Test bench for the Slack bot: the same agent, typed into a box. Nothing here is saved or sent anywhere. */
export function AdminAgent() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const send = async (said: string) => {
    const q = said.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setText("");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? `Something went wrong (${r.status}).`);
      setTurns([...next, { role: "assistant", content: b.reply, steps: b.steps }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the bot.");
    }
    setBusy(false);
    setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 50);
  };

  return (
    <main className="page [&>*:not(.fixed)]:max-w-3xl">
      <PageTitle>Bot sandbox</PageTitle>
      <p className="mb-6 text-sm text-muted">Try the Brand Creative bot here before it goes into Slack. It answers brand questions from the Hub library. Nothing you type is saved.</p>
      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      <section className="card p-6" aria-label="Conversation">
        {turns.length === 0 ? (
          <div>
            <p className="mb-4 text-sm text-muted">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => <button key={e} onClick={() => send(e)} className="btn btn-sm btn-secondary">{e}</button>)}
            </div>
          </div>
        ) : (
          <ol className="space-y-4" aria-live="polite">
            {turns.map((t, i) => (
              <li key={i} className={t.role === "user" ? "text-right" : ""}>
                <div className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-loose px-4 py-2 text-left text-sm ${t.role === "user" ? "bg-brand-soft text-ink" : "bg-n-150"}`}>{t.content}</div>
                {t.steps && t.steps.length > 0 && <p className="mt-2 text-xs text-muted">Used: {t.steps.map((s) => `${s.tool}(${JSON.stringify(s.input)})`).join(", ")}</p>}
              </li>
            ))}
            {busy && <li className="text-sm text-muted">Thinking…</li>}
            <div ref={end} />
          </ol>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="mt-4 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Message the bot" placeholder="Ask about a logo, color, icon or photo…" maxLength={2000} className="block w-full rounded-tight border border-control bg-white px-4 py-2 text-sm" />
          <button type="submit" disabled={busy || !text.trim()} className="btn btn-md btn-primary"><Icon name="reply" size={16} />Send</button>
        </form>
        {turns.length > 0 && <button onClick={() => { setTurns([]); setError(null); }} className="mt-4 text-sm font-medium text-brand hover:underline">Start over</button>}
      </section>
    </main>
  );
}
