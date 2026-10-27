# Notification system: plan

Status: proposal, nothing built. Decisions needed are listed at the bottom.

## Goal
Tell people the moment something needs them (a ticket is waiting on them, feedback was asked for, someone replied), without nagging. System notifications (the OS pop-ups) are the headline channel. Everyone controls what they get, and admins set the defaults.

## What we already have
- A bell and a "Waiting on you" inbox for blocked tickets (`/api/me`, `lib/store/blocks.ts`).
- Per-person documents in Vercel Blob (tasks, Google connection), plus an audit log.
- Review comments, approvals and feedback requests, still mock data until review data moves to Blob.
- Jira tokens only exist while someone is signed in (they live in the session cookie).

## Events (what can notify)
| Event | Goes to | Default | Source |
|---|---|---|---|
| Ticket marked blocked on you | the person named | System + in-app, cannot be turned off | Hub (exists) |
| Feedback requested of you | reviewers | System + in-app | Hub submit |
| Reply or @mention on a review | the person | System + in-app | Hub review |
| Design approved or changes requested | submitter | System + in-app | Hub review |
| Feedback due soon (24h, 2h) | reviewers who haven't finished | In-app, system at 2h | Cron |
| Ticket assigned to you | assignee | System + in-app | Jira |
| Ticket you're on changed status | assignee, reporter | In-app | Jira |
| Past due / due today | assignee | Morning digest | Cron |
| A ticket blocking yours was finished | assignee | In-app | Jira links |
| Your task is due (has a time) | owner | System | Cron |
| Admin: Figma or Google credentials expiring or failing | admins | In-app | Health checks |

## Channels
1. **In-app inbox.** Bell with unread count, a list grouped by day, "mark all read", deep links. Always on.
2. **System notifications.** Browser notifications shown by the OS (macOS, Windows, Android).
   - Step 1: Notification API while a Hub tab is open.
   - Step 2: Web Push with a service worker, so they arrive when the tab is closed. Needs VAPID keys (env vars) and each person's push subscription stored in Blob.
   - Needs a one-time "Allow notifications" prompt, asked from a button, never on page load. iPhone and iPad only deliver web push after "Add to Home Screen".
3. **Email digest.** Later. Morning summary of what's overdue and waiting.
4. **Slack.** Later (cut from v1 in the handover).

## Preferences
- **Per person:** a grid of event × channel (in-app, system, email), quiet hours with their time zone, digest time, and mute for a single ticket or project. Lives in a "Notifications" page reachable from the bell and the Admin menu.
- **Admins (Admin > Notifications):**
  - Defaults for every event and role.
  - Mark events as required so people can't turn them off (for example "waiting on you").
  - Turn a channel off for the whole org.
  - A quiet-hours default.
  - "Send me a test notification".
  - A delivery log: sent, read, failed.

## How it works
- One function, `notify(event)`, writes an inbox item to the person's Blob document, checks their preferences and the org defaults, then sends to each allowed channel. Every item has a dedupe key so a re-run never sends twice.
- Push payloads carry the minimum: a short title and a link. The ticket title is only included if that person can see the ticket in Jira.
- Clicking opens the deep link (a ticket, a review thread, Waiting on you).
- Hub-originated events fire from the existing actions. Time-based ones come from a scheduled job.
- **Jira changes are the hard part.** The server has no Jira token when nobody is signed in. Options:
  - **A. Jira webhook** to a Hub endpoint (needs a Jira admin to register it). Best.
  - **B. A small service account** that a scheduled job uses to poll.
  - **C. Poll while the Hub is open** (the bell already refreshes). Cheapest, but nothing arrives when the tab is closed.
  - Recommendation: ship C first, move to A.

## Constraints to know
- **Vercel Hobby cron runs once a day.** Hourly deadline reminders need the company Vercel team (already on the handoff list).
- Web push is not available in some locked-down corporate browsers; the in-app inbox is the safety net.
- Quiet hours must follow each person's own time zone.

## Phases
1. **Inbox and preferences (about 1 session).** Notification store, bell and inbox page, per-person preferences, Admin > Notifications defaults, wire the events the Hub already creates.
2. **System notifications (about 1 session).** Permission flow, in-tab notifications, then service worker + Web Push, test button.
3. **Reminders (about 1 session).** Cron for due-soon feedback, due tasks and the morning digest.
4. **Jira events.** Webhook endpoint (or polling) for assigned, status changed, linked blocker cleared.
5. **Email digest.**

## Decisions needed
1. **"Preferences in the admin area":** should each person manage their own settings there (so requesters see it too), with admins also setting org defaults? (Recommended.) Or do you want only admins to control it?
2. **Day-one events:** is the table above right, or should some wait?
3. **Jira changes:** can a Jira admin register a webhook for MKTGCRTV? If not, start with polling while the Hub is open.
4. **Email:** include the morning digest now or later?
5. **Vercel plan:** are we moving to the company team soon? It decides whether time-based reminders can be hourly.
