import { open, seal, userDocId } from "@/lib/google/crypto";
import { readDoc, updateDoc } from "./doc";

// One document per person holding their Google connection. The refresh token is sealed (AES-GCM); the
// short-lived access token is cached next to it so most requests skip the refresh round trip.
type Conn = {
  email: string;
  googleEmail: string;
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  scopes: string[];
  connectedAt: string;
  /** Set when Google rejected the refresh token, so the UI can ask the person to reconnect. */
  broken?: boolean;
};
type Doc = { conn: Conn | null };
const empty = (): Doc => ({ conn: null });
const name = (email: string) => `google/${userDocId(email)}`;

export type GoogleConn = { googleEmail: string; scopes: string[]; refreshToken: string; accessToken?: string; expiresAt?: number; broken?: boolean };

export async function getConnection(email: string): Promise<GoogleConn | null> {
  const { data } = await readDoc(name(email), empty);
  if (!data.conn) return null;
  const refreshToken = open(data.conn.refreshToken);
  if (!refreshToken) return null;
  return { googleEmail: data.conn.googleEmail, scopes: data.conn.scopes, refreshToken, accessToken: data.conn.accessToken ? open(data.conn.accessToken) ?? undefined : undefined, expiresAt: data.conn.expiresAt, broken: data.conn.broken };
}

export async function saveConnection(email: string, c: { googleEmail: string; refreshToken: string; accessToken: string; expiresAt: number; scopes: string[] }): Promise<void> {
  await updateDoc(name(email), empty, () => ({
    data: { conn: { email, googleEmail: c.googleEmail, refreshToken: seal(c.refreshToken), accessToken: seal(c.accessToken), expiresAt: c.expiresAt, scopes: c.scopes, connectedAt: new Date().toISOString() } },
    result: undefined,
  }));
}

export async function cacheAccessToken(email: string, accessToken: string, expiresAt: number): Promise<void> {
  await updateDoc(name(email), empty, (d) => {
    if (d.conn) { d.conn.accessToken = seal(accessToken); d.conn.expiresAt = expiresAt; d.conn.broken = undefined; }
    return { data: d, result: undefined };
  });
}

export async function markBroken(email: string): Promise<void> {
  await updateDoc(name(email), empty, (d) => {
    if (d.conn) d.conn.broken = true;
    return { data: d, result: undefined };
  });
}

export async function deleteConnection(email: string): Promise<void> {
  await updateDoc(name(email), empty, () => ({ data: { conn: null }, result: undefined }));
}
