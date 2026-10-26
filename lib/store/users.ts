import { readDoc, updateDoc } from "./doc";

export type UserRole = "requester" | "creative" | "admin";
export type UserStatus = "active" | "disabled";

export type UserRecord = {
  email: string;
  name: string;
  accountId?: string;
  role: UserRole;
  status: UserStatus;
  addedBy: string;
  addedAt: string;
  firstSignIn?: string;
  lastSignIn?: string;
};

export type AuditEntry = { at: string; actor: string; action: string; target: string; detail?: string };

type UsersDoc = { seeded?: boolean; users: Record<string, UserRecord> };
type AuditDoc = { entries: AuditEntry[] };

export class AdminError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const DOMAIN = "@surveymonkey.com";
const csv = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const emptyUsers = (): UsersDoc => ({ users: {} });
const emptyAudit = (): AuditDoc => ({ entries: [] });
const now = () => new Date().toISOString();

/** Admins set in the environment can never be locked out through the UI. Recovery path for the owner. */
export const envAdmins = () => csv(process.env.ADMIN_EMAILS);
const envCreatives = () => csv(process.env.CREATIVE_EMAILS);
export const isEnvAdmin = (email: string) => envAdmins().includes(email.toLowerCase());

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();
export function assertWorkEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || !email.endsWith(DOMAIN)) {
    throw new AdminError(400, `Use a ${DOMAIN} address.`);
  }
}

/** First run only: bring the env lists in as real records so they can be managed in the app afterwards. */
function seed(d: UsersDoc): UsersDoc {
  if (d.seeded) return d;
  const stamp = now();
  const add = (email: string, role: UserRole) => {
    d.users[email] ??= { email, name: "", role, status: "active", addedBy: "environment", addedAt: stamp };
  };
  envCreatives().forEach((e) => add(e, "creative"));
  envAdmins().forEach((e) => { add(e, "admin"); d.users[e].role = "admin"; });
  d.seeded = true;
  return d;
}

// Short read cache so every API request doesn't hit the store. Writes clear it on this instance;
// other instances pick up changes within the TTL.
let cache: { at: number; data: UsersDoc } | null = null;
const TTL_MS = 10_000;

async function usersDoc(): Promise<UsersDoc> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const { data } = await readDoc("users", emptyUsers);
  cache = { at: Date.now(), data };
  return data;
}

export type Access = { role: UserRole; active: boolean; record?: UserRecord };

/** What this person may do right now. Unknown people get the env-seeded default (creative if listed, else requester). */
export async function resolveAccess(email: string): Promise<Access> {
  const e = normalizeEmail(email);
  if (isEnvAdmin(e)) return { role: "admin", active: true };
  let doc: UsersDoc;
  try {
    doc = await usersDoc();
  } catch {
    // Store unreachable: fall back to the env lists rather than locking everyone out.
    return { role: envCreatives().includes(e) ? "creative" : "requester", active: true };
  }
  const record = doc.users[e];
  if (record) return { role: record.role, active: record.status === "active", record };
  return { role: envCreatives().includes(e) ? "creative" : "requester", active: true };
}

/** "creative" and "admin" see every ticket; requesters only their own. */
export const visibilityRole = (r: UserRole) => (r === "requester" ? "requester" : "creative");

export async function recordSignIn(p: { email: string; name?: string; accountId?: string }): Promise<{ active: boolean }> {
  const email = normalizeEmail(p.email);
  const out = await updateDoc("users", emptyUsers, (d) => {
    seed(d);
    let created = false;
    let rec = d.users[email];
    if (!rec) {
      created = true;
      rec = d.users[email] = {
        email, name: p.name ?? "", role: envCreatives().includes(email) ? "creative" : "requester",
        status: "active", addedBy: "self sign-up", addedAt: now(),
      };
    }
    if (isEnvAdmin(email)) rec.role = "admin";
    rec.name = p.name || rec.name;
    rec.accountId = p.accountId || rec.accountId;
    rec.firstSignIn ??= now();
    rec.lastSignIn = now();
    return { data: d, result: { active: rec.status === "active", created } };
  });
  cache = null;
  if (out.created) await audit({ actor: email, action: "user.first_signin", target: email });
  return { active: out.active };
}

export async function listUsers(): Promise<UserRecord[]> {
  cache = null;
  const { data } = await readDoc("users", emptyUsers);
  const doc = seed(structuredClone(data));
  return Object.values(doc.users).sort((a, b) => a.email.localeCompare(b.email));
}

function activeAdminCount(d: UsersDoc, except?: string): number {
  const admins = new Set(envAdmins());
  for (const u of Object.values(d.users)) if (u.role === "admin" && u.status === "active" && u.email !== except) admins.add(u.email);
  return admins.size;
}

export async function addUser(actor: string, emailRaw: string, role: UserRole): Promise<UserRecord> {
  const email = normalizeEmail(emailRaw);
  assertWorkEmail(email);
  const rec = await updateDoc("users", emptyUsers, (d) => {
    seed(d);
    if (d.users[email]) throw new AdminError(409, `${email} is already on the list.`);
    const r: UserRecord = { email, name: "", role, status: "active", addedBy: actor, addedAt: now() };
    d.users[email] = r;
    return { data: d, result: r };
  });
  cache = null;
  await audit({ actor, action: "user.add", target: email, detail: `role ${role}` });
  return rec;
}

export async function updateUser(actor: string, emailRaw: string, patch: { role?: UserRole; status?: UserStatus }): Promise<UserRecord> {
  const email = normalizeEmail(emailRaw);
  if (isEnvAdmin(email)) throw new AdminError(403, "This admin is set in the environment (ADMIN_EMAILS) and can't be changed here.");
  const { rec, detail } = await updateDoc("users", emptyUsers, (d) => {
    seed(d);
    const r = d.users[email];
    if (!r) throw new AdminError(404, "User not found.");
    const losesAdmin = r.role === "admin" && ((patch.role && patch.role !== "admin") || patch.status === "disabled");
    if (losesAdmin && activeAdminCount(d, email) < 1) throw new AdminError(409, "You can't remove the last admin. Make someone else an admin first.");
    if (email === normalizeEmail(actor) && patch.status === "disabled") throw new AdminError(409, "You can't disable your own account.");
    const bits: string[] = [];
    if (patch.role && patch.role !== r.role) { bits.push(`role ${r.role} to ${patch.role}`); r.role = patch.role; }
    if (patch.status && patch.status !== r.status) { bits.push(patch.status === "disabled" ? "disabled" : "re-enabled"); r.status = patch.status; }
    return { data: d, result: { rec: r, detail: bits.join(", ") } };
  });
  cache = null;
  if (detail) await audit({ actor, action: "user.update", target: email, detail });
  return rec;
}

export async function removeUser(actor: string, emailRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  if (isEnvAdmin(email)) throw new AdminError(403, "This admin is set in the environment (ADMIN_EMAILS) and can't be removed here.");
  await updateDoc("users", emptyUsers, (d) => {
    seed(d);
    const r = d.users[email];
    if (!r) throw new AdminError(404, "User not found.");
    if (email === normalizeEmail(actor)) throw new AdminError(409, "You can't remove your own account.");
    if (r.role === "admin" && activeAdminCount(d, email) < 1) throw new AdminError(409, "You can't remove the last admin.");
    delete d.users[email];
    return { data: d, result: undefined };
  });
  cache = null;
  await audit({ actor, action: "user.remove", target: email });
}

const AUDIT_CAP = 500;

export async function audit(e: Omit<AuditEntry, "at">): Promise<void> {
  try {
    await updateDoc("audit", emptyAudit, (d) => ({
      data: { entries: [...d.entries, { at: now(), ...e }].slice(-AUDIT_CAP) },
      result: undefined,
    }));
  } catch {
    // Auditing is best effort; never fail the action it describes.
  }
}

export async function readAudit(limit = 50): Promise<AuditEntry[]> {
  const { data } = await readDoc("audit", emptyAudit);
  return data.entries.slice(-limit).reverse();
}
