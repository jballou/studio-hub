import NextAuth from "next-auth";
import Atlassian from "next-auth/providers/atlassian";
import { findCloudId } from "@/lib/jira/client";
import { recordSignIn } from "@/lib/store/users";

const ALLOWED_DOMAIN = "@surveymonkey.com";
const TOKEN_URL = "https://auth.atlassian.com/oauth/token";

/** Swaps the refresh token for a new access token. Atlassian rotates refresh tokens, so the new one must be kept. */
async function refresh(token: import("next-auth/jwt").JWT): Promise<import("next-auth/jwt").JWT> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: process.env.AUTH_ATLASSIAN_ID,
        client_secret: process.env.AUTH_ATLASSIAN_SECRET,
        refresh_token: token.refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    Atlassian({
      authorization: {
        params: {
          audience: "api.atlassian.com",
          // Read scopes only until ticket creation and comment push are built.
          scope: "read:me read:jira-work read:jira-user offline_access",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    // Only @surveymonkey.com Atlassian accounts with a verified email may sign in, and only while not disabled by an admin.
    async signIn({ profile }) {
      const email = String(profile?.email ?? "").toLowerCase();
      if (!email.endsWith(ALLOWED_DOMAIN) || profile?.email_verified === false) return false;
      try {
        const { active } = await recordSignIn({ email, name: profile?.name ?? undefined, accountId: String(profile?.account_id ?? "") });
        return active;
      } catch {
        // If the user store is briefly unreachable, don't lock everyone out. Every API call re-checks access anyway.
        return true;
      }
    },
    async jwt({ token, account, profile }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          cloudId: account.access_token ? await findCloudId(account.access_token) : undefined,
          accountId: String(profile?.account_id ?? token.sub ?? ""),
          error: undefined,
        };
      }
      // 60s of slack so a token never expires mid-request.
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) return token;
      if (!token.refreshToken) return { ...token, error: "RefreshTokenError" };
      return refresh(token);
    },
    // Tokens stay in the encrypted cookie; the browser-visible session only gets non-secret fields.
    // Roles are not stored in the cookie: they are looked up live so an admin's change applies immediately.
    session({ session, token }) {
      session.error = token.error;
      return session;
    },
  },
});
