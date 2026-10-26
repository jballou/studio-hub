import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    role: "creative" | "requester";
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** seconds since epoch */
    expiresAt?: number;
    cloudId?: string;
    accountId?: string;
    role?: "creative" | "requester";
    error?: string;
  }
}
