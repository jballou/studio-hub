"use client";

import { useEffect, useState } from "react";
import { Callout } from "@/components/ui/Tag";
import { settingsRepo } from "@/lib/data";
import { LOOKBACK_MAX, LOOKBACK_MIN, LOOKBACK_PRESETS, lookbackLabel, parseLookback } from "@/lib/settings";

const CUSTOM = "custom";

export function AdminSettings() {
  const [saved, setSaved] = useState<number | null>(null);
  const [choice, setChoice] = useState<string>("90");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    settingsRepo.get().then((s) => {
      setSaved(s.projectLookbackDays);
      const preset = (LOOKBACK_PRESETS as readonly number[]).includes(s.projectLookbackDays);
      setChoice(preset ? String(s.projectLookbackDays) : CUSTOM);
      setCustom(preset ? "" : String(s.projectLookbackDays));
    }).catch(() => setError("Couldn't load the settings."));
  }, []);

  const days = choice === CUSTOM ? parseLookback(custom) : Number(choice);
  const dirty = days !== null && days !== saved;

  const save = async () => {
    if (days === null) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const s = await settingsRepo.save({ projectLookbackDays: days });
      setSaved(s.projectLookbackDays);
      setNote(`Saved. Project lists now show closed work from ${lookbackLabel(s.projectLookbackDays)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-5 text-sm text-muted">Organization-wide. Changes apply to everyone the next time they load a page.</p>

      <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="lookback">
        <h2 id="lookback" className="text-lg font-semibold">How far back project lists go</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Closed projects finished longer ago than this are left out of the Projects page. Open projects always show, and searching by key or title still finds older ones.</p>

        <fieldset>
          <legend className="sr-only">Look-back period</legend>
          <div className="flex flex-wrap gap-2">
            {LOOKBACK_PRESETS.map((n) => (
              <label key={n} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${choice === String(n) ? "border-brand bg-brand-soft font-medium" : "border-control bg-white hover:bg-brand-soft"}`}>
                <input type="radio" name="lookback" className="sr-only" checked={choice === String(n)} onChange={() => setChoice(String(n))} />
                {n} days{n === 90 ? " (default)" : ""}
              </label>
            ))}
            <label className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${choice === CUSTOM ? "border-brand bg-brand-soft font-medium" : "border-control bg-white hover:bg-brand-soft"}`}>
              <input type="radio" name="lookback" className="sr-only" checked={choice === CUSTOM} onChange={() => setChoice(CUSTOM)} />
              Custom
            </label>
          </div>
          {choice === CUSTOM && (
            <label className="mt-3 block text-sm font-semibold">Number of days
              <input
                type="number"
                min={LOOKBACK_MIN}
                max={LOOKBACK_MAX}
                step={1}
                inputMode="numeric"
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                aria-invalid={custom !== "" && days === null}
                className="mt-1 block w-40 rounded-lg border border-control bg-white px-3 py-2 text-sm font-normal"
              />
              <span className={`mt-1 block text-xs font-normal ${custom !== "" && days === null ? "text-bad-fg" : "text-muted"}`}>A whole number from {LOOKBACK_MIN} to {LOOKBACK_MAX}.</span>
            </label>
          )}
        </fieldset>

        {error && <div className="mt-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}
        {note && <div className="mt-4"><Callout tone="ok" icon="check">{note}</Callout></div>}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} disabled={!dirty || busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-n-50 enabled:hover:bg-brand-dark disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
          {saved !== null && <span className="text-sm text-muted">Currently {saved} days.</span>}
        </div>
      </section>
    </main>
  );
}
