import { cached, invalidateUser } from "@/lib/jira/cache";
import { BRIEF_FIELDS, JiraError, requestorField, searchIssues, tokenScopes } from "@/lib/jira/client";
import { createBriefIssue, validateBrief } from "@/lib/jira/create";
import { PROJECT_KEY, toProject } from "@/lib/jira/map";
import { errorResponse, jiraSession } from "@/lib/jira/session";
import { lookbackClause } from "@/lib/settings";
import { getSettings } from "@/lib/store/settings";
import { audit } from "@/lib/store/users";

/**
 * GET  My briefs: tickets I reported or am named Requestor on (if the site has that field), newest first.
 * Open ones always; closed ones inside the same look-back window as the Projects page.
 */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const { projectLookbackDays } = await getSettings();
    const { value: projects, stale } = await cached(s.accountId, `briefs|${projectLookbackDays}`, 60_000, async () => {
      const rf = await requestorField(s.auth);
      const mine = rf ? `(reporter = currentUser() OR cf[${rf.replace("customfield_", "")}] = currentUser())` : "reporter = currentUser()";
      const issues = await searchIssues(s.auth, `project = ${PROJECT_KEY} AND ${mine} AND ${lookbackClause(projectLookbackDays)} ORDER BY created DESC`, BRIEF_FIELDS, 50);
      return issues.map(toProject);
    });
    return Response.json({ projects, stale });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST { title, issueTypeId, typeLabel, deadline?, stakeholders, sections }  Creates the Jira ticket for a brief, as the signed-in person. */
export async function POST(req: Request) {
  try {
    const s = await jiraSession(req);
    const input = validateBrief(await req.json().catch(() => ({})));
    let key: string;
    try {
      key = await createBriefIssue(s.auth, input, { accountId: s.accountId, name: s.name });
    } catch (e) {
      // A sign-in from before the write permission was added can read but not create.
      if (e instanceof JiraError && (e.status === 401 || e.status === 403)) {
        const scopes = await tokenScopes(s.auth);
        if (scopes && !scopes.includes("write:jira-work")) {
          throw new JiraError(403, "Your sign-in doesn't include permission to create tickets yet. Sign out and sign back in (one new Atlassian consent screen), then send the brief again.");
        }
      }
      throw e;
    }
    invalidateUser(s.accountId);
    await audit({ actor: s.email, action: "brief.create", target: key, detail: input.title.slice(0, 120) });
    return Response.json({ key }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
