import NextAuth from "next-auth";
import Atlassian from "next-auth/providers/atlassian";
import { findCloudId, isInJiraGroup } from "@/lib/jira/client";

const ALLOWED_DOMAIN = "@surveymonkey.com";
const TOKEN_URL = "https://auth.atlassian.com/oauth/token";

const creativeEmails = () =>
  (process.env.CREATIVE_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

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
    // Only @surveymonkey.com Atlassian accounts with a verified email may sign in.
    signIn({ profile }) {
      const email = String(profile?.email ?? "").toLowerCase();
      return email.endsWith(ALLOWED_DOMAIN) && profile?.email_verified !== false;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        const email = String(profile?.email ?? token.email ?? "").toLowerCase();
        const cloudId = account.access_token ? await findCloudId(account.access_token) : undefined;
        const accountId = String(profile?.account_id ?? token.sub ?? "");
        // Creative if listed by email, or in a Jira group named in CREATIVE_GROUP. Checked at sign-in,
        // so a group change applies the next time that person signs in.
        let creative = creativeEmails().includes(email);
        if (!creative && cloudId && account.access_token && process.env.CREATIVE_GROUP) {
          creative = await isInJiraGroup(
            { accessToken: account.access_token, cloudId },
            accountId,
            process.env.CREATIVE_GROUP.split(","),
          );
        }
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          cloudId,
          accountId,
          role: creative ? ("creative" as const) : ("requester" as const),
          error: undefined,
        };
      }
      // 60s of slack so a token never expires mid-request.
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) return token;
      if (!token.refreshToken) return { ...token, error: "RefreshTokenError" };
      return refresh(token);
    },
    // Tokens stay in the encrypted cookie; the browser-visible session only gets non-secret fields.
    session({ session, token }) {
      session.role = token.role ?? "requester";
      session.error = token.error;
      return session;
    },
  },
});
