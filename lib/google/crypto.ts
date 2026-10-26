import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

// Google refresh tokens are long-lived, so they are encrypted at rest with a key derived from AUTH_SECRET.
// Rotating AUTH_SECRET makes stored tokens unreadable; people just reconnect Google.
function key(label: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return Buffer.from(hkdfSync("sha256", secret, "brand-creative-hub", label, 32));
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key("google-tokens"), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function open(sealed: string): string | null {
  try {
    const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key("google-tokens"), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Signs the OAuth `state` so the callback can prove the request started here, for this person, recently. */
export function signState(email: string, nonce: string, exp: number): string {
  const body = `${email}|${nonce}|${exp}`;
  const sig = createHmac("sha256", key("google-state")).update(body).digest("base64url");
  return `${Buffer.from(body).toString("base64url")}.${sig}`;
}

export function readState(state: string): { email: string; nonce: string } | null {
  const [b, sig] = state.split(".");
  if (!b || !sig) return null;
  const body = Buffer.from(b, "base64url").toString();
  const want = createHmac("sha256", key("google-state")).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const [email, nonce, exp] = body.split("|");
  if (!email || !nonce || Date.now() > Number(exp)) return null;
  return { email, nonce };
}

/** Document name for one person's data. Hashed so emails never appear in storage paths. */
export const userDocId = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24);
