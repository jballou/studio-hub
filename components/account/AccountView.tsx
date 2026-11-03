"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/review/Avatar";
import { googleRepo, isJira, type GoogleStatus } from "@/lib/data";
import { useMe } from "@/hooks/useMe";
import { setSounds, soundsOn } from "@/lib/sfx";
import { PageTitle } from "@/components/PageTitle";

const PROFILE_URL = "https://id.atlassian.com/manage-profile/profile-and-visibility";

function Section({ id, icon, title, children }: { id?: string; icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="card scroll-mt-8 p-6">
      <h2 id={`${id ?? title}-h`} className="flex items-center gap-2 text-lg font-bold"><Icon name={icon} size={18} /> {title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Your own account: who you are, what pings you, and which outside tools are connected. */
export function AccountView() {
  const me = useMe();
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSound(soundsOn());
    googleRepo.status().then(setGoogle).catch(() => setGoogle({ configured: false, connected: false }));
  }, []);

  const initials = me?.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const role = me ? (me.isAdmin ? "Admin" : me.role === "creative" ? "Creative team" : "Requester") : "";

  return (
    <main className="page [&>*]:max-w-3xl">
      <PageTitle>Account</PageTitle>
      <div className="mt-6 space-y-6">
        <Section icon="userRound" title="Profile">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar user={me ? { id: me.id, name: me.name, role: me.role, initials: initials ?? "" } : undefined} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{me?.name ?? ""}</p>
              <p className="text-sm text-muted">{me?.email ?? "Demo account"}</p>
            </div>
            {role && <Tag tone="neutral">{role}</Tag>}
          </div>
          <p className="mt-4 text-sm text-muted">Your name, email and photo come from your Atlassian account, so changes are made there.</p>
          <a href={PROFILE_URL} target="_blank" rel="noreferrer" className="btn btn-md btn-secondary mt-4 inline-flex"><Icon name="pencil" size={16} /> Edit profile in Atlassian</a>
        </Section>

        <Section id="notifications" icon="bell" title="Notifications">
          <p className="text-sm text-muted">The bell in the sidebar shows review requests, new versions, approvals and change requests, plus projects waiting on you.</p>
          <label className="mt-4 flex items-center gap-4 text-sm font-medium">
            <input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); setSounds(e.target.checked); }} className="h-4 w-4 accent-brand" />
            Play sound effects
          </label>
        </Section>

        <Section icon="link" title="Connected accounts">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold">Google Calendar and Tasks</p>
              <p className="text-sm text-muted">Shows today&apos;s meetings on My Day and backs up your personal tasks.</p>
            </div>
            {google === null ? <span className="text-sm text-muted">Checking…</span>
              : google.connected ? (
                <div className="flex items-center gap-2">
                  <Tag tone="ok" icon="check">{google.googleEmail ?? "Connected"}</Tag>
                  {isJira && <button onClick={async () => { await googleRepo.disconnect(); setGoogle({ ...google, connected: false }); }} className="btn btn-md btn-secondary">Disconnect</button>}
                </div>
              )
              : google.configured ? <a href="/api/google/connect" className="btn btn-md btn-primary">Connect Google</a>
              : <Tag tone="warn" icon="alert">Not set up yet. Ask an admin.</Tag>}
          </div>
        </Section>
      </div>
    </main>
  );
}
