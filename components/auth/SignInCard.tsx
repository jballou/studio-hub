"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { ShaderBackground } from "./ShaderBackground";

const DOMAIN = "@surveymonkey.com";

/** Centered sign-in card over the animated background. The only thing asked is a work email; Atlassian confirms it's really you. */
export function SignInCard({ action, error, callbackUrl }: { action: (formData: FormData) => void | Promise<void>; error?: string; callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const clean = email.trim().toLowerCase();
  const valid = clean.endsWith(DOMAIN) && clean.length > DOMAIN.length;
  const showHint = touched && clean.length > 0 && !valid;

  return (
    <>
      <ShaderBackground />
      <main className="grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl [html[data-theme=dark]_&]:border-white/10 [html[data-theme=dark]_&]:bg-[#151c18]/80">
          <Logo size={56} className="mb-5 shadow-md" />
          <h1 className="text-2xl font-bold">Brand Creative Hub</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Briefs, reviews and your day, all tied to your Jira tickets.</p>

          {error && <p role="alert" className="mb-4 rounded-lg border border-bad-line bg-bad-bg px-3 py-2 text-sm text-bad-fg">{error}</p>}

          <form action={action} onSubmit={(e) => { if (!valid) { e.preventDefault(); setTouched(true); } }} noValidate>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <label htmlFor="email" className="block text-sm font-semibold">Work email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              inputMode="email"
              placeholder={`you${DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={showHint}
              aria-describedby="email-hint"
              className={`mt-1 w-full rounded-xl border bg-white px-4 py-3 text-base ${showHint ? "border-bad-fg" : "border-control"}`}
            />
            <p id="email-hint" className={`mt-1.5 min-h-5 text-xs ${showHint ? "font-medium text-bad-fg" : "text-muted"}`}>
              {showHint ? `Use your ${DOMAIN} address.` : `Only ${DOMAIN} accounts can sign in.`}
            </p>
            <button className="mt-3 w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-n-50 hover:bg-brand-dark focus-visible:outline-offset-4">Continue</button>
          </form>

          <p className="mt-5 text-center text-xs text-muted">Atlassian will ask you to confirm it&apos;s you. Right after, you can optionally connect Google Calendar and Tasks.</p>
        </div>
      </main>
    </>
  );
}
