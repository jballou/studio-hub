import { exchangeCode, idTokenEmail, SCOPES } from "@/lib/google/client";
import { readState } from "@/lib/google/crypto";
import { jiraSession } from "@/lib/jira/session";
import { getConnection, saveConnection } from "@/lib/store/google";
import { audit } from "@/lib/store/users";

const NEED = SCOPES.filter((s) => s.startsWith("https://"));

/** GET /api/google/callback  Google sends the person back here with a one-time code. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (flag: string) => new Response(null, { status: 303, headers: { Location: `${url.origin}/my-day?google=${flag}`, "Set-Cookie": "google_oauth_nonce=; Path=/api/google; Max-Age=0" } });
  try {
    const s = await jiraSession(req);
    if (url.searchParams.get("error")) return back("denied");
    const st = readState(url.searchParams.get("state") ?? "");
    const cookieNonce = /(?:^|;\s*)google_oauth_nonce=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
    // The request must have started here, for this person, in this browser, within ten minutes.
    if (!st || st.email !== s.email || !cookieNonce || cookieNonce !== st.nonce) return back("failed");
    const code = url.searchParams.get("code");
    if (!code) return back("failed");

    const tok = await exchangeCode(code, `${url.origin}/api/google/callback`);
    const who = idTokenEmail(tok.id_token);
    if (!who?.verified || !who.email.endsWith("@surveymonkey.com")) return back("wrong-account");
    // Google's consent screen lets people untick individual permissions; both are needed.
    const granted = (tok.scope ?? "").split(" ");
    if (!NEED.every((n) => granted.includes(n))) return back("partial");
    const refreshToken = tok.refresh_token ?? (await getConnection(s.email))?.refreshToken;
    if (!refreshToken) return back("failed");

    await saveConnection(s.email, { googleEmail: who.email, refreshToken, accessToken: tok.access_token, expiresAt: Math.floor(Date.now() / 1000) + tok.expires_in, scopes: granted });
    await audit({ actor: s.email, action: "google.connect", target: s.email }).catch(() => {});
    return back("connected");
  } catch {
    return back("failed");
  }
}
