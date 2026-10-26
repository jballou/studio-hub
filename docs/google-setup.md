# Google setup (My Day: calendar and Tasks backup)

One-time, done by whoever owns the Google Cloud project. Use a company-owned project, not a personal one, so the app survives people leaving.

1. Google Cloud console > create (or pick) a project owned by the company.
2. APIs & Services > Library: enable **Google Calendar API** and **Google Tasks API**.
3. APIs & Services > OAuth consent screen: User type **Internal** (limits sign-in to @surveymonkey.com and avoids Google verification). App name "Brand Creative Hub". Add scopes:
   - `.../auth/calendar.events.readonly`
   - `.../auth/tasks`
   - `openid`, `email`
4. Credentials > Create credentials > OAuth client ID > **Web application**. Authorized redirect URIs:
   - `https://<production host>/api/google/callback`
   - `http://localhost:3100/api/google/callback` (local dev)
5. Put the Client ID and Client secret in Vercel (Production and Preview), then redeploy:
   ```bash
   vercel env add GOOGLE_CLIENT_ID production
   vercel env add GOOGLE_CLIENT_SECRET production
   ```
6. Admin > System shows "Google" as healthy once both are present. Each person then clicks **Connect Google** on My Day.

What the app can do with the grant: read events on the person's primary calendar, and create/update/delete tasks (it only touches its own list named "Brand Creative Hub"). It cannot change calendar events.

Disconnecting (My Day > Disconnect) revokes the grant at Google and deletes the stored tokens. Tasks already in Google Tasks stay there.
