# Transfer Ownership

Run this when handing the Brand Creative Hub to a team, or before the original builder leaves. It supersedes the table in `docs/HANDOFF.md`, which still describes Vercel Blob as the data store. Items marked **(verify)** are from memory of how the vendor consoles work.

Never paste secrets into chat, tickets or this repo. Set them with `vercel env add`.

## Order of operations
1. Put people in place: a second admin, a shared mailbox for service accounts.
2. Move the accounts the app lives on (GitHub, Vercel).
3. Move the integrations (Atlassian, Google, Figma).
4. Re-check env vars and redeploy.
5. Verify (last section).

## 1. People and roles
- **`ADMIN_EMAILS`** (Vercel env, locked admins): keep at least two people. These people can use every Preferences page, including OKRs.
  ```bash
  vercel env add ADMIN_EMAILS --environment production --type config --force --value "a@surveymonkey.com,b@surveymonkey.com"
  ```
  Redeploy after changing it.
- Other roles are managed in the app: Preferences → Team & access.
- **Shared mailbox:** create one (for example `brand-creative-hub@surveymonkey.com`) to own the Figma account and, if wanted, other service accounts. Make sure at least two people can read it.

## 2. Accounts the app lives on
| System | Today | Do |
|---|---|---|
| **GitHub** `jballou/studio-hub` | Personal account | Transfer to a company org (Settings → Danger zone), or add a second admin collaborator. Reconnect Vercel to the new location. |
| **Vercel** project `studio-hub` | Personal Hobby team `jarrodballou-7311` | Hobby teams can't have members. Move the project to a company team on a plan that allows them (Project → Settings → Transfer). After the move recheck: env vars, Git connection, the Upstash integration, the cron in `vercel.json`, and the production domain **(verify)**. |
| **Upstash Redis** | Added through the Vercel integration | It holds all app data, including private notes and reports. Confirm it moved with the project and that a second person can open it. Env vars: `KV_REST_API_URL`, `KV_REST_API_TOKEN`. |
| **Vercel AI Gateway** (once model calls ship) | Billed to the owning Vercel team | Make sure the new team has a payment method and a spend limit. Auth is `AI_GATEWAY_API_KEY` or Vercel OIDC. |

## 3. Integrations
### Atlassian (sign-in and Jira)
- OAuth app "Brand Creative Hub" at developer.atlassian.com is owned by one person. Add a second owner or collaborator in the app's Settings, or recreate it under a shared owner and update `AUTH_ATLASSIAN_ID` and `AUTH_ATLASSIAN_SECRET` **(verify)**.
- Scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`, `read:me`. See `docs/atlassian-oauth-setup.md`.
- If the production URL changes, update the callback: `https://<host>/api/auth/callback/atlassian`.

### Google (My Day calendar and Tasks, review playback, OKR sync)
- Cloud project: company-owned, with a group (not just individuals) holding Owner/Editor in IAM, and at least two Owners.
- APIs enabled: Calendar, Tasks, Drive, **Sheets**.
- Consent screen: user type **Internal**. Scopes: `calendar.events.readonly`, `tasks`, `drive.readonly` (restricted), `spreadsheets.readonly` (sensitive), plus `openid` and `email`.
- OAuth client redirect URIs: `https://<host>/api/google/callback` and the local one. Update them if the host changes.
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **OKR sync** runs on the signed-in admin's own Google token (Preferences → OKRs → Connect Google Sheets). When someone leaves, another admin connects and syncs. Nothing to transfer, but tell the new owner this is manual.
- Anyone who has connected Google can disconnect from My Day. Tokens are sealed with a key derived from `AUTH_SECRET`.

### Figma (optional frame picker)
- Env: `FIGMA_ACCESS_TOKEN`. It is a personal access token tied to the Figma account that created it. Without it people still paste frame links.
- Create it from a dedicated account on the shared mailbox, with only **File content: Read**, and the longest expiry.
- Put a renewal reminder on the team calendar. Replace with `vercel env add FIGMA_ACCESS_TOKEN production`, then redeploy.
- Add that account as a viewer on the files and team spaces people submit from. Keep it out of private spaces. See `docs/figma-setup.md`.

### Other tokens (if in use)
- `CRON_SECRET`: protects the daily trash cleanup cron.
- `JIRA_SITE_URL`, `JIRA_REQUESTOR_FIELD`, `JIRA_START_DATE_FIELD`: Jira site and custom field ids. If fields are recreated in Jira the ids change.
- `OKR_SHEET_ID` (optional): default OKR Sheet. Normally set in Preferences → OKRs instead.
- Wistia, if used for video playback: record whose account owns the token **(verify)**.

## 4. Environment variables checklist
Vercel → Project → Settings → Environment Variables. Names only:

`AUTH_SECRET`, `AUTH_ATLASSIAN_ID`, `AUTH_ATLASSIAN_SECRET`, `JIRA_SITE_URL`, `JIRA_REQUESTOR_FIELD`, `JIRA_START_DATE_FIELD`, `ADMIN_EMAILS`, `CREATIVE_EMAILS`, `NEXT_PUBLIC_DATA_SOURCE`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FIGMA_ACCESS_TOKEN`, `CRON_SECRET`, `OKR_SHEET_ID`, and the AI Gateway key once added.

Rotating `AUTH_SECRET` signs everyone out and makes stored Google tokens unreadable, so people reconnect Google. Rotate it only on purpose.

## 5. Data and privacy duties
- Everything lives in Upstash Redis under `production/`. Private notes and reports sit under `me/<hash>/…` and have **no admin read path by design**. Do not add one when handing over. The owner of the Redis account can still read raw values, so name that person in your privacy statement.
- When someone leaves, their `me/*` data should be deleted. `purgeMyData` exists in `lib/store/me.ts` but nothing calls it yet. Until it's wired to offboarding, delete their keys by hand.
- Run before and after the move: `npm run check:private`, `npm run check:design`, `npx tsc --noEmit`, `npx next build`.

## 6. Verify after the transfer
- [ ] A new admin can sign in and open Preferences → System; every check is green.
- [ ] The deploy builds from the new repo location and shows Ready in `vercel ls`.
- [ ] The daily cron ran (`/api/cron/trash`).
- [ ] A new admin connected Google Sheets and synced OKRs.
- [ ] My Day calendar and Tasks connect for a non-admin.
- [ ] Figma frame picker works (or the paste-link fallback is understood).
- [ ] A second person can open the Atlassian app, Google Cloud project, Upstash and the Vercel team.
- [ ] The old owner is removed from each system.
