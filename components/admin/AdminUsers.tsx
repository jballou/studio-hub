"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Callout, Tag } from "@/components/ui/Tag";
import { isJira } from "@/lib/data/mode";
import { PageTitle } from "@/components/PageTitle";

type Role = "requester" | "creative" | "admin";
type UserRow = { email: string; name: string; role: Role; lead?: boolean; status: "active" | "disabled"; addedBy: string; addedAt: string; lastSignIn?: string };
type AuditRow = { at: string; actor: string; action: string; target: string; detail?: string };

const ROLE_HELP: Record<Role, string> = {
  requester: "Sees only tickets they are on",
  creative: "Sees every ticket, reviews and resolves",
  admin: "Creative, plus manages people here",
};
const ROLES = Object.keys(ROLE_HELP) as Role[];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const ACTION_LABEL: Record<string, string> = {
  "user.add": "added", "user.update": "changed", "user.remove": "removed", "user.first_signin": "signed in for the first time",
  "block.create": "marked as blocked", "block.reassign": "changed who is blocking", "block.resolve": "cleared the block on",
  "flow.update": "edited", "flow.restore": "restored", "flow.reset": "reset",
};

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [envAdmins, setEnvAdmins] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [me, setMe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("requester");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (res.status === 403) return setDenied(true);
    if (!res.ok) return setError(body.error ?? `Couldn't load people (${res.status}).`);
    setUsers(body.users);
    setEnvAdmins(body.envAdmins);
    setAudit(body.audit);
    setMe(body.me);
    setError(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isJira) load();
  }, [load]);

  const call = async (url: string, init: RequestInit) => {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => ({}));
    await load();
    // Show the server's message after reloading, since a successful reload clears errors.
    if (!res.ok) setError(body.error ?? `Request failed (${res.status}).`);
    setBusy(false);
    return res.ok;
  };

  const patch = (u: UserRow, change: { role?: Role; status?: "active" | "disabled"; lead?: boolean }) =>
    call(`/api/admin/users/${encodeURIComponent(u.email)}`, { method: "PATCH", body: JSON.stringify(change) });

  if (!isJira) {
    return (
      <main className="page [&>*:not(.fixed)]:max-w-3xl">
        <PageTitle>Team &amp; access</PageTitle>
        <p className="mt-2 text-sm text-muted">This screen is available once sign-in is turned on (NEXT_PUBLIC_DATA_SOURCE=jira).</p>
      </main>
    );
  }
  if (denied) {
    return (
      <main className="page [&>*:not(.fixed)]:max-w-3xl">
        <PageTitle>Team &amp; access</PageTitle>
        <p className="mt-2 text-sm text-muted">Only Brand Creative admins can manage people. Ask an admin if you need a change.</p>
      </main>
    );
  }

  const shown = (users ?? []).filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const sel = "rounded-tight border border-control bg-white px-2 py-2 text-sm";

  return (
    <main className="page">
      <PageTitle>Team &amp; access</PageTitle>
      <p className="mb-6 mt-2 text-sm text-muted">Anyone with a SurveyMonkey Atlassian account can sign in as a requester. Use this page to give people more access or take it away.</p>

      {error && <div className="mb-4"><Callout tone="bad" icon="alert">{error}</Callout></div>}

      <section className="mb-6 card p-4">
        <h2 className="mb-2 text-sm font-bold">Add someone before their first sign-in</h2>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call("/api/admin/users", { method: "POST", body: JSON.stringify({ email, role }) })) setEmail("");
          }}
        >
          <label className="min-w-64 flex-1 text-xs font-bold">Work email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@surveymonkey.com" type="email" className={`${sel} mt-2 w-full font-normal`} required />
          </label>
          <label className="text-xs font-bold">Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${sel} mt-2 block font-normal`}>
              {ROLES.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
            </select>
          </label>
          <button disabled={busy || !email} className="btn btn-md btn-primary">Add</button>
        </form>
        <p className="mt-2 text-xs text-muted">{ROLE_HELP[role]}.</p>
      </section>

      <div className="mb-2 flex items-center gap-4">
        <h2 className="text-sm font-bold">People ({users?.length ?? "…"})</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search people" className={`${sel} ml-auto w-52`} />
      </div>
      <div className="overflow-x-auto card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-n-150 text-xs text-n-800">
            <tr><th className="px-4 py-2 font-bold">Person</th><th className="px-4 py-2 font-bold">Role</th><th className="px-4 py-2 font-bold">Team lead</th><th className="px-4 py-2 font-bold">Status</th><th className="px-4 py-2 font-bold">Last sign-in</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {users === null && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Loading…</td></tr>}
            {shown.map((u) => {
              const locked = envAdmins.includes(u.email);
              const self = u.email === me;
              return (
                <tr key={u.email} className={`border-b border-line last:border-0 ${u.status === "disabled" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2"><div className="font-medium">{u.name || u.email.split("@")[0]}</div><div className="text-xs text-muted">{u.email}{self && " (you)"}</div></td>
                  <td className="px-4 py-2">
                    {locked ? <Tag tone="info" icon="check" title="Set in the ADMIN_EMAILS environment variable">Admin (locked)</Tag> : (
                      <select aria-label={`Role for ${u.email}`} value={u.role} disabled={busy} onChange={(e) => patch(u, { role: e.target.value as Role })} className={sel}>
                        {ROLES.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <label className="flex items-center gap-2 text-xs" title={u.role === "requester" ? "Only creatives and admins can be team leads" : "Can open anyone's work in My Day"}>
                      <input type="checkbox" checked={!!u.lead} disabled={busy || u.role === "requester"} onChange={(e) => patch(u, { lead: e.target.checked })} aria-label={`Team lead: ${u.email}`} />
                      {u.lead ? "Team lead" : "No"}
                    </label>
                  </td>
                  <td className="px-4 py-2"><Tag tone={u.status === "active" ? "ok" : "neutral"} icon={u.status === "active" ? "check" : "close"}>{u.status === "active" ? "Active" : "Disabled"}</Tag></td>
                  <td className="px-4 py-2 text-xs text-muted">{when(u.lastSignIn)}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    {!locked && !self && (
                      <span className="flex justify-end gap-4">
                        <button disabled={busy} onClick={() => patch(u, { status: u.status === "active" ? "disabled" : "active" })} className="font-medium text-brand hover:underline">{u.status === "active" ? "Disable" : "Enable"}</button>
                        <button disabled={busy} onClick={() => { if (confirm(`Remove ${u.email}? They can still sign in as a requester. Use Disable to block them.`)) call(`/api/admin/users/${encodeURIComponent(u.email)}`, { method: "DELETE" }); }} className="font-medium text-bad-fg hover:underline">Remove</button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {users && shown.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No one matches.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-start gap-2 text-xs text-muted"><Icon name="alert" size={14} /> <span><b>Disable</b> blocks sign-in and API access right away. <b>Remove</b> only deletes the record; the person can sign back in as a requester. <b>Team leads</b> can open any creative&apos;s Jira work in My Day and see the team in total. They do not see personal tasks, calendars, notes or reports. Locked admins come from the <code>ADMIN_EMAILS</code> setting so the app can never be left without an owner.</span></p>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-bold">Recent changes</h2>
        {audit.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
          <ul className="divide-y divide-line card text-sm">
            {audit.map((a, i) => (
              <li key={i} className="flex flex-wrap gap-x-2 px-4 py-2">
                <span className="w-36 shrink-0 text-xs text-muted">{when(a.at)}</span>
                <span><b>{a.actor}</b> {ACTION_LABEL[a.action] ?? a.action} <b>{a.target}</b>{a.detail ? ` (${a.detail})` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
