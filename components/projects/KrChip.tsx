"use client";

import { Tag } from "@/components/ui/Tag";
import { useOkr } from "@/hooks/useOkr";
import type { Project } from "@/lib/types";

const short = (s: string) => (s.length > 32 ? `${s.slice(0, 31)}…` : s);

/** Which KR a project supports. Renders nothing for untagged work and when no OKRs are synced, so lists stay quiet. */
export function KrChip({ project }: { project: Pick<Project, "krId" | "krNone"> }) {
  const { krs } = useOkr();
  if (project.krNone) return <Tag tone="neutral" title="Not tied to a KR (business as usual)">BAU</Tag>;
  if (!project.krId) return null;
  const k = krs.find((x) => x.id === project.krId);
  return k ? <Tag tone="info" title={`${k.objective} › ${k.kr}`}>{short(k.kr)}</Tag> : <Tag tone="neutral" title="This KR is no longer in the OKR sheet">KR removed</Tag>;
}
