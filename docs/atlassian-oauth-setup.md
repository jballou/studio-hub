# Atlassian OAuth 2.0 (3LO) setup

The app signs people in with Atlassian and calls Jira as them (so Jira's own Browse permissions apply).
Menu names below are from memory of the Atlassian developer console; if a label differs, the intent is the same.

## 1. Create the app
1. Go to https://developer.atlassian.com/console/myapps/ (signed in as your @surveymonkey.com account).
2. **Create → OAuth 2.0 integration**.
3. Name: `Brand Creative Hub`. Accept the terms. **Create**.

## 2. Permissions (scopes)
Open **Permissions** and **Add** these, then **Configure** each:

| API | Scopes |
|---|---|
| Jira API | `read:jira-work`, `read:jira-user`, `write:jira-work` |
| User identity API | `read:me` |

`offline_access` is not listed in the console; the app requests it in the sign-in URL so tokens can refresh.
The code currently requests read scopes only. `write:jira-work` is configured now so adding ticket creation and comment push later does not need a new app.

## 3. Callback URL (Authorization)
**Authorization → OAuth 2.0 (3LO) → Configure → Callback URL:**

- Production: `https://studio-hub-kohl-theta.vercel.app/api/auth/callback/atlassian`
- Local dev: `http://localhost:3100/api/auth/callback/atlassian`

If the console accepts only one callback URL, create a second app named `Brand Creative Hub (dev)` for local use.
If you add a custom domain later, add its callback URL too.

## 4. Distribution (so teammates can sign in, not only you)
**Distribution → Edit**, set status to **Sharing**. Atlassian asks for:
- Vendor name (SurveyMonkey)
- Privacy policy URL (use your company policy URL)
- Whether the app stores personal data: **Yes** (names/emails in session cookies)

An Atlassian org admin may need to allow the app under Atlassian Admin → Apps. If teammates see an "admin approval required" screen, send the admin the app name and client ID.

## 5. Copy credentials
**Settings** shows **Client ID** and **Secret**. Treat the secret like a password.
Do not paste it in chat. Put it in the places below yourself.

## 6. Environment variables
Local: add to `.env.local` (git-ignored). Production: use `vercel env add NAME production` (it prompts, so the secret is not in shell history).

| Name | Value |
|---|---|
| `AUTH_SECRET` | random string: `openssl rand -base64 32` |
| `AUTH_ATLASSIAN_ID` | Client ID |
| `AUTH_ATLASSIAN_SECRET` | Secret |
| `JIRA_SITE_URL` | `https://surveymonkey.atlassian.net` |
| `ADMIN_EMAILS` | comma-separated owners who can always manage people (keep at least two) |
| `CREATIVE_EMAILS` | starting list of creatives, used once when the user list is first created |
| `NEXT_PUBLIC_DATA_SOURCE` | `jira` (omit or `mock` to keep demo data) |

Redeploy after setting production variables.

## Known limits of this first version
- Tokens live in an encrypted session cookie (no database yet). Refresh tokens rotate, and two simultaneous requests can race a refresh;
  moving tokens to the database with a per-user lock (planned) removes that.
- Only Jira reads are wired. Creating tickets, pushing comments, and the review/asset data are still mock.
