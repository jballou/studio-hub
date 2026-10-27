# Brand Creative Hub: ownership and handoff

Goal: someone else on the Brand Creative team can run this without the original builder.
Items marked **(verify)** are from memory of how the vendor consoles work; confirm them when you do the transfer.

## 1. Who can manage people in the app
- Admins manage access at **Team & access** (sidebar, admins only): add people, set Requester / Creative / Admin, disable or remove, and see recent changes.
- **Locked admins** come from the `ADMIN_EMAILS` environment variable. They can't be changed in the app, so the app can never be left without an owner.
  - Keep at least two people in `ADMIN_EMAILS`.
  - To add or swap an owner: `vercel env add ADMIN_EMAILS --environment production --type config --force --value "a@surveymonkey.com,b@surveymonkey.com"`, then redeploy.
- Anyone with a `@surveymonkey.com` Atlassian account can sign in as a **Requester**. **Disable** blocks sign-in and API access immediately.

## 2. Accounts and systems to transfer
| System | Today | To do before the original owner leaves |
|---|---|---|
| **GitHub** repo `jballou/studio-hub` | Personal account | Transfer to a company org, or add a team member as admin collaborator (Settings → Collaborators; transfer under Settings → Danger zone). Re-connect Vercel to the new repo location |
| **Vercel** project `studio-hub` | Personal Hobby team `jarrodballou-7311` | Hobby teams cannot have members. Move the project to a company team (Project → Settings → Transfer) on a plan that allows members. Re-check env vars, the Blob store and Git connection after the move **(verify)** |
| **Atlassian OAuth app** "Brand Creative Hub" | Owned by one person in developer.atlassian.com | Add a second owner or collaborator in the app's Settings, or recreate it under a shared/service owner and update the client ID and secret **(verify)**. Distribution is "Sharing" |
| **Vercel Blob** store `studio-hub-data` (private) | Linked to the project | Moves with the project; confirm after transfer. Holds the user list and audit log |
| **Jira** | Users sign in with their own accounts | Nothing to transfer. Access follows each person's Jira permissions |
| **Figma / Google tokens** | Not set up yet | When added, record the owner here and prefer a shared service account |

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Purpose |
|---|---|
| `AUTH_SECRET` | signs session cookies. Rotating it signs everyone out |
| `AUTH_ATLASSIAN_ID`, `AUTH_ATLASSIAN_SECRET` | the Atlassian OAuth app credentials |
| `JIRA_SITE_URL` | `https://surveymonkey.atlassian.net` |
| `ADMIN_EMAILS` | locked owners (see above) |
| `CREATIVE_EMAILS` | starting list of creatives, used once to seed the user list |
| `NEXT_PUBLIC_DATA_SOURCE` | `jira` turns on sign-in and real data. Remove it to return to the demo |
| `BLOB_READ_WRITE_TOKEN` | created by `vercel blob create-store`; access to the data store |

## 4. Where data lives
- **Jira**: tickets, statuses, people (read with each user's own token).
- **Vercel Blob** (private): `production/users.json` (people and roles) and `production/audit.json` (last 500 changes). Writes are conditional, so simultaneous edits don't overwrite each other.
- `production/blocks.json`: who each blocked ticket is waiting on, with reason and history (resolved blocks are kept, so time-blocked can be reported later).
- `production/fav-<hash>.json`: one small file per person with their starred projects.
- Review assets, comments and feedback requests are still **demo data**; they move to Blob (or Postgres) next.

## 4b. Blocked work
- Jira's workflow has a **Blocked** status (also At Risk, On Hold, Need More Info) but no field for *who* a ticket is waiting on, so the app records that. Creatives and admins mark a project blocked and name the person; that person sees it under **Waiting on you** and in the sidebar bell, and can clear it.
- The app does **not** yet change the Jira status when you mark something blocked (that needs the `write:jira-work` scope to be requested at sign-in). Until then, move the ticket to Blocked in Jira as well.

## 5. If someone is locked out
1. Another admin changes their role in Team & access, or
2. Anyone with Vercel access updates `ADMIN_EMAILS` (see section 1) and redeploys.

## 6. Day-to-day
- Deploys: every push to `main` deploys to production automatically.
- Roll back to demo mode: `vercel env rm NEXT_PUBLIC_DATA_SOURCE production --yes`, then redeploy.
- Atlassian setup steps: `docs/atlassian-oauth-setup.md`.

## 7. My Day, personal tasks and Google

- **My Day** (`/my-day`) combines the person's open Jira tickets, today's Google Calendar events and their own tasks. Ranking is rule-based (`lib/myday/plan.ts`), not AI.
- **Personal tasks** are stored in Vercel Blob (`tasks/<hash of email>`), one document per person, and are never written to Jira. They appear on the Calendar as "My task" items visible only to their owner.
- **Google** is a per-person connection (not the sign-in). Tokens are encrypted with a key derived from `AUTH_SECRET` and stored in Blob (`google/<hash>`). Rotating `AUTH_SECRET` means everyone reconnects Google. Setup and ownership of the Google Cloud project: `docs/google-setup.md`.
- **Backup is one-way** (app to Google Tasks list "Brand Creative Hub"). Edits made in Google Tasks are not pulled back.
- **Jira status write-back:** marking a ticket Blocked moves it to Jira status "Blocked"; clearing the block moves it back to the status it had. This needs the `write:jira-work` scope; people who signed in before it was added must sign out and back in once.

## 8. Feedback batches and Figma

- Sending several items together (several Figma frames, several files, or a mix) creates a **batch**: each item is its own review with its own comments, grouped by a shared batch id. Reviewers move between items with Previous and Next.
- **Choose frames** (Figma file link) lists a file's frames with thumbnails using one shared token, `FIGMA_ACCESS_TOKEN` (see `docs/figma-setup.md`). The token's owner must expire-track it; when it lapses the picker shows a message and people paste frame links instead.

## 9. Hierarchy, linked work, dark mode and sound effects

- **Hierarchy and links** (project page): parents (initiative, epic), children and sub-tasks come from Jira's `parent` field and `parent = KEY` searches; linked work comes from `issuelinks` (Blocks, Relates, others; Clones are skipped on purpose). Code: `lib/jira/relations.ts`, `components/projects/RelationsCard.tsx`.
- **Dark mode**: palette tokens are swapped in `app/globals.css` under `[data-theme="dark"]`; the choice is saved in this browser (`hub-theme`) and defaults to the system setting. A small head script applies it before first paint.
- **Sounds**: `public/sounds/celebrate.wav` (finishing work, approving a design) and `night-night.wav` (turning dark mode on). Confetti is skipped for people who prefer reduced motion. The speaker button in the sidebar mutes sounds (`hub-sounds`).
