"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/hooks/useMe";
import { teamRepo } from "@/lib/data";
import type { Person } from "@/lib/types";
import { MyDay } from "./MyDay";
import { TeamDay, ViewPicker } from "./TeamDay";

/** My Day. Team leads also get a picker to open one creative's work or the whole team's. Everyone else just gets their own day. */
export function MyDayHome() {
  const me = useMe();
  const lead = !!me?.isLead;
  const [view, setView] = useState("me");
  const [members, setMembers] = useState<Person[]>([]);

  useEffect(() => {
    if (!lead) return;
    teamRepo.members().then(setMembers).catch(() => setMembers([]));
  }, [lead]);

  const picker = lead ? <ViewPicker value={view} members={members} onChange={setView} /> : null;
  if (lead && view !== "me") return <TeamDay person={view} members={members} picker={picker} onPick={setView} />;
  return <MyDay headerExtra={picker} />;
}
