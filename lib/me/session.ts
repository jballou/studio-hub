import { jiraSession } from "@/lib/jira/session";
import { userDocId } from "@/lib/google/crypto";

declare const meBrand: unique symbol;

/**
 * The signed-in person, and nobody else. The private store (`lib/store/me.ts`) only accepts this type,
 * and the only way to get one is `requireMe`, which reads the identity from the session cookie.
 * A route can't pass an email or id from a URL, query string or body into the private store.
 */
export type Me = {
  readonly [meBrand]: true;
  readonly email: string;
  readonly name: string;
  readonly docId: string;
};

export async function requireMe(req: Request): Promise<Me> {
  const s = await jiraSession(req);
  const email = s.email.trim().toLowerCase();
  return { email, name: s.name, docId: userDocId(email) } as Me;
}
