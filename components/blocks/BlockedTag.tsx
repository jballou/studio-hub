import { Tag } from "@/components/ui/Tag";
import type { Block, ProjectFlag } from "@/lib/types";

const FLAG_LABEL: Record<ProjectFlag, string> = {
  blocked: "Blocked", "at-risk": "At risk", "on-hold": "On hold", "needs-info": "Needs info",
};

/** Blocked tag with who it's waiting on. Jira's own flags (at risk, on hold…) show as plain tags. */
export function FlagTags({ flag, block }: { flag?: ProjectFlag; block?: Block }) {
  if (block) {
    return <Tag tone="bad" icon="close" title={`${block.reason} (since ${new Date(block.since).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`}>Blocked by {block.blockedBy.name}</Tag>;
  }
  if (flag === "blocked") return <Tag tone="bad" icon="close" title="Blocked in Jira, but nobody is named yet">Blocked · who?</Tag>;
  if (flag === "at-risk") return <Tag tone="warn" icon="alert">At risk</Tag>;
  if (flag === "on-hold") return <Tag tone="neutral" icon="alert">On hold</Tag>;
  if (flag === "needs-info") return <Tag tone="info" icon="alert">Needs info</Tag>;
  return null;
}
export { FLAG_LABEL };

export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
