import { randomBytes } from "node:crypto";
import { authUrl, configured } from "@/lib/google/client";
import { signState } from "@/lib/google/crypto";
import { errorResponse, jiraSession } from "@/lib/jira/session";

const COOKIE = "google_oauth_nonce";

/** GET /api/google/connect  Sends the signed-in person to Google's consent screen. */
export async function GET(req: Request) {
  try {
    const s = await jiraSession(req);
    const origin = new URL(req.url).origin;
    if (!configured()) return Response.redirect(`${origin}/my-day?google=not-configured`, 303);
    const nonce = randomBytes(16).toString("base64url");
    // Where to land afterwards: the welcome step or My Day, nothing else.
    const back = new URL(req.url).searchParams.get("return") === "welcome" ? "welcome" : "my-day";
    const state = signState(s.email, nonce, Date.now() + 10 * 60_000);
    const secure = origin.startsWith("https:");
    const attrs = `Path=/api/google; Max-Age=600; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
    const headers = new Headers({ Location: authUrl(`${origin}/api/google/callback`, state, s.email) });
    // Two separate cookies: the one-time check value, and where to land afterwards.
    headers.append("Set-Cookie", `${COOKIE}=${nonce}; ${attrs}`);
    headers.append("Set-Cookie", `google_oauth_return=${back}; ${attrs}`);
    return new Response(null, { status: 303, headers });
  } catch (e) {
    return errorResponse(e);
  }
}
