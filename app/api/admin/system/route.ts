import { readDoc } from "@/lib/store/doc";
import { activeBlocks } from "@/lib/store/blocks";
import { listUsers } from "@/lib/store/users";
import { adminSession, errorResponse } from "@/lib/jira/session";
import { startDateField, tokenScopes } from "@/lib/jira/client";

type Check = { id: string; label: string; ok: boolean; detail: string };

const REQUIRED_ENV = [
  "AUTH_SECRET", "AUTH_ATLASSIAN_ID", "AUTH_ATLASSIAN_SECRET", "JIRA_SITE_URL", "ADMIN_EMAILS", "BLOB_READ_WRITE_TOKEN", "NEXT_PUBLIC_DATA_SOURCE",
];

/** GET: health of each connection the app depends on. Names and counts only, never secret values. */
export async function GET(req: Request) {
  try {
    const s = await adminSession(req);
    const checks: Check[] = [];

    try {
      const res = await fetch(`https://api.atlassian.com/ex/jira/${s.auth.cloudId}/rest/api/3/myself`, {
        headers: { Authorization: `Bearer ${s.auth.accessToken}`, Accept: "application/json" }, cache: "no-store",
      });
      checks.push({ id: "jira", label: "Jira connection", ok: res.ok, detail: res.ok ? `Reachable as ${s.name}` : `Jira answered HTTP ${res.status}` });
    } catch {
      checks.push({ id: "jira", label: "Jira connection", ok: false, detail: "Couldn't reach Jira" });
    }

    {
      // One retry: a store that is only briefly busy shouldn't read as broken.
      let failure: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const t0 = Date.now();
          await readDoc("users", () => ({}), { fresh: true }); // a real read of the store, not a cached copy
          const [users, blocks] = await Promise.all([listUsers(), activeBlocks()]);
          checks.push({ id: "blob", label: "Data store (Vercel Blob)", ok: true, detail: `Reachable in ${Date.now() - t0} ms. ${users.length} people, ${blocks.length} active blocks.` });
          failure = null;
          break;
        } catch (e) {
          failure = e;
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      if (failure) {
        console.error("[system] blob check failed", failure);
        // The error's name and message come from the Blob SDK and never contain the token. They say whether it is a bad token, a suspended store, a quota limit or a busy store.
        const why = failure instanceof Error ? `${failure.name}: ${failure.message}`.slice(0, 300) : "unknown error";
        checks.push({ id: "blob", label: "Data store (Vercel Blob)", ok: false, detail: `Couldn't read the store (${why}). If this says token or access, check BLOB_READ_WRITE_TOKEN; if it says limit or suspended, check the store in the Vercel dashboard.` });
      }
    }

    const missing = REQUIRED_ENV.filter((n) => !process.env[n]);
    checks.push({
      id: "env", label: "Settings (environment variables)", ok: missing.length === 0,
      detail: missing.length ? `Missing: ${missing.join(", ")}` : `All ${REQUIRED_ENV.length} present`,
    });

    const scopes = await tokenScopes(s.auth);
    const canWrite = !!scopes?.includes("write:jira-work");
    checks.push({ id: "jirawrite", label: "Jira write permission (your sign-in)", ok: canWrite, detail: scopes ? (canWrite ? "This sign-in can change tickets (status, start date)." : "This sign-in is read-only. Sign out and back in to allow status and start-date changes. If it still fails, the Atlassian app needs the write:jira-work scope enabled.") : "Couldn't read this sign-in's permissions." });

    try {
      const sf = await startDateField(s.auth);
      checks.push({ id: "startdate", label: "Jira Start date field", ok: !!sf, detail: sf ? `Found (${sf}). Tickets with an empty start date are flagged.` : "No field named “Start date” was found, so “Plan work” is off. Set JIRA_START_DATE_FIELD to its id (customfield_…) if it has another name." });
    } catch {
      checks.push({ id: "startdate", label: "Jira Start date field", ok: false, detail: "Couldn't check" });
    }

    const google = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
    checks.push({ id: "google", label: "Google (My Day calendar and Tasks backup)", ok: google, detail: google ? "Client credentials present" : "Not set up. My Day shows Jira work only. See docs/google-setup.md" });

    const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    checks.push({ id: "owners", label: "Locked admins", ok: admins.length >= 2, detail: admins.length >= 2 ? `${admins.length} owners set` : "Set at least two in ADMIN_EMAILS so access survives someone leaving" });

    return Response.json({
      checks,
      build: { env: process.env.VERCEL_ENV ?? "local", commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null, site: process.env.JIRA_SITE_URL ?? null },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
