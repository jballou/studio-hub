# Brand Creative Hub: handoff

For starting a fresh Claude Code session. Project: `/Users/jballou/Desktop/Studio Hub`. Read `AGENTS.md` first: this is a newer Next.js (16, App Router) than most training data, so check `node_modules/next/dist/docs/` before writing framework code.

## What it is
Brand Creative Hub for SurveyMonkey's Brand Creative team. Next.js 16, React 19, TypeScript, Tailwind v4, Auth.js v5 (Atlassian OAuth), Jira (project MKTGCRTV), Upstash Redis as the data store, hosted on Vercel.

## Working rules (from the user)
- **Never push to origin main without an explicit "Push"/"yes".** The pattern: commit locally, show a summary, ask, then push, wait about 70s and confirm `vercel ls` shows the new deployment **Ready**.
- Secrets never go in chat. The user runs `vercel env add`. Pulling production env secrets was blocked.
- Ask before creating real Jira tickets or publishing anything.
- Never include respondent PII.
- Org output rules: concise, minimum response that fully answers, deliverables output complete in chat.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Current git state
- Branch `main`. Everything is pushed except **`baa0113` "Analytics You/Team toggle gets icons"** (local only, tsc and eslint pass, not viewed in a browser).
- `.claude/launch.json` shows as modified and is not mine. Leave it unless asked.

## Open request (not done)
Use the **Wrench Design System (WDS) "User" and "UsersGroup" icons** on the Analytics You/Team toggle (`components/analytics/AnalyticsView.tsx`, `seg-item` buttons). Right now it uses hand-drawn `user` and `users` icons in `components/ui/Icon.tsx`.
- The `wrench-ds` plugin (org marketplace, WebExperience team) is enabled, but its `wds` MCP tools did not load in the old session. In the new session run **`/wrench-ds:setup-mcp`**, then use `/wrench-ds:find-component`. May need a sign-in.
- Storybook/Chromatic: https://main--64fa83944fe3d464e0b5bd27.chromatic.com/?path=/story/intro-homepage--home (needs SurveyMonkey sign-in; I could not read it).
- Fallback: the user sends the two SVGs or a Figma link. Drop them into `Icon.tsx` as `user` and `users`.
- WDS is React plus JSS. This hub is Tailwind. Icons are an easy swap. Do not swap components without the user deciding first.

## Design system (enforced by `npm run check:design`, i.e. `node scripts/check-design.mjs`)
- **Spacing:** multiples of 8px (even Tailwind steps).
- **Type scale (Figma tokens in `app/globals.css`):** `text-xs` 12 … `text-2xl` 24, `3xl` 28, `4xl` 36, `headline-lg` 42, `5xl` 48 (Display Small), `display-md` 60, `display-lg` 76. `.eyebrow` for small caps group labels. One bold weight (`font-bold`; the font has no semibold file).
- **Corners:** only `rounded-tight` (8px: buttons, inputs, menu rows), `rounded-round` (pill: tags, chips, toggles, avatars), `rounded-loose` (24px: cards, dialogs, popovers). The check fails on any other `rounded-*`. `.card` is the loose container.
- **Buttons (`.btn`, in `app/globals.css`):** sizes `btn-sm` 32px, `btn-md` 40px (default), `btn-lg` 48px. Looks `btn-primary` (flat green, no shadow), `btn-secondary`, `btn-danger`, `btn-ghost`. Icon only: `btn-icon`. One neutral hover (`n-150`) for everything except solid green, which darkens.
- **Other shared styles:** `.chip` (filter or option pill), `.seg` / `.seg-item` (segmented control; the green highlight slides via `components/SegIndicator.tsx`), `FilterPill` / `FilterOption` in `components/ui/FilterPill.tsx` (Stripe-style filters), `Menu`, `ConfirmDialog`, `DatePicker` (has `size` and `align`), native `select` gets a custom chevron globally.
- **Overlays:** `fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-n-1000/40 p-4`.
- **Page frame:** gray `--shell` background, sidebar on it, each page in one large rounded panel with a slim breadcrumb and clock bar (`components/Shell.tsx`, `app/layout.tsx`). Content width 1280px, left aligned (`.page`).
- Primary interaction color is green-500 `#089b5e` (`--color-brand`).

## What was built recently (all pushed unless noted)
- **Brand Review brief type:** data-driven wizard flow in `lib/brief/defaultFlow.ts`. Jira issue type "Other" (12117) plus label `brand-review`. A saved flow version overrides the default, so an admin must use "Reset to built-in" to see new branches.
- **Brief builder:** "By request type" route view (`components/brief/RouteView.tsx`, `lib/brief/routes.ts`) plus a restyled full map.
- **Review comments:** severity 0–4 (red `!!`, orange `!`, yellow flag, green flag, gray bubble; `components/review/Severity.tsx`), editing with an "Edited" marker (author only, enforced in `lib/store/review.ts`), severity included when pushed to Jira.
- **Projects tab:** creative team can change status (`StatusMenu`) and due date (`DueDateEdit`, `POST /api/jira/projects/[key]/due`) inline. Filters are Stripe-style pills behind a Filters button. Status filter lists the real Jira statuses on screen; "Person" lists requesters and assignees on screen.
- **Calendar list view:** sort and collapse-all are icon buttons on the list, so the toolbar toggle never moves.
- **My Day:** greeting in Display Small, rounded solid-color gauge, Plan work button top right of each priority card.

## Open items and caveats
- **Blob store is suspended.** File uploads go through Redis (25 MB cap). Review data lives in Upstash Redis via `lib/store/doc.ts`.
- User still needs to: reconnect Google (Drive scope) and test Wistia/Drive playback, Analytics and Plan work on real data; set `CRON_SECRET` for the daily Trash cleanup; answer earlier notification-plan questions; optionally set up a staging branch.
- Not visually checked after the design pass: Team, Calendar month/week, admin pages, Brief builder, dark mode.
- Collaborator/Person filter and Status filter were only checked in demo data, not real Jira.

## Dev notes
- Preview: `rebuild.sh` in the old session's scratchpad does `next build` then `next start -p 3101`. It is session-specific; recreate with `npx next build && npx next start -p 3101`. Demo mode runs without Jira sign-in. Opening `/review/<id>` directly can hang on "Loading…" in demo, so click through from `/review`.
- Checks before committing: `npx tsc --noEmit`, `npx eslint components app lib`, `node scripts/check-design.mjs`, `npx next build`.
- Deploy check: `vercel ls | sed -n 4,6p` (CLI is outdated: `npm i -g vercel@latest`).
