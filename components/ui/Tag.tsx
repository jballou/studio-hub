import type { ReactNode } from "react";
import type { Project, Stage } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

export type Tone = "neutral" | "info" | "progress" | "warn" | "ok" | "bad" | "gold";

const TONES: Record<Tone, string> = {
  neutral: "bg-n-150 border-n-200 text-n-800",
  info: "bg-info-bg border-info-line text-info-fg",
  progress: "bg-progress-bg border-progress-line text-progress-fg",
  warn: "bg-warn-bg border-warn-line text-warn-fg",
  ok: "bg-ok-bg border-ok-line text-ok-fg",
  bad: "bg-bad-bg border-bad-line text-bad-fg",
  gold: "bg-gold-bg border-gold-line text-gold-fg",
};

/** Pill with tint surface, matching border and a leading icon, so status never relies on color alone. */
export function Tag({ tone, icon, children, title }: { tone: Tone; icon?: IconName; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-6 items-center gap-2 whitespace-nowrap rounded-full border px-2 text-xs font-medium ${TONES[tone]}`}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

const STAGE: Record<Stage, { tone: Tone; icon: IconName }> = {
  Submitted: { tone: "neutral", icon: "submitted" },
  "In review": { tone: "info", icon: "review" },
  "In progress": { tone: "progress", icon: "progress" },
  "In feedback": { tone: "warn", icon: "feedback" },
  Delivered: { tone: "ok", icon: "delivered" },
};

export function StageTag({ stage }: { stage: Stage }) {
  const s = STAGE[stage];
  return <Tag tone={s.tone} icon={s.icon}>{stage}</Tag>;
}

const CATEGORY: Record<NonNullable<Project["statusCategory"]>, { tone: Tone; icon: IconName }> = {
  new: { tone: "neutral", icon: "submitted" },
  indeterminate: { tone: "info", icon: "progress" },
  done: { tone: "ok", icon: "delivered" },
};

/**
 * The ticket's status as Jira names it (Done, Intake, At Risk…), colored like Jira's categories: gray to do, blue in
 * progress, green done. Demo data has no Jira status, so it falls back to the app's stage.
 */
export function StatusTag({ project }: { project: Pick<Project, "stage" | "statusName" | "statusCategory"> }) {
  if (!project.statusName) return <StageTag stage={project.stage} />;
  const c = CATEGORY[project.statusCategory ?? "indeterminate"];
  return <Tag tone={c.tone} icon={c.icon}>{project.statusName}</Tag>;
}

/** Notification-style callout: tint surface, icon, text. */
export function Callout({ tone, icon, children }: { tone: Tone; icon: IconName; children: ReactNode }) {
  return (
    <div role="status" className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${TONES[tone]}`}>
      <Icon name={icon} size={16} />
      {children}
    </div>
  );
}

export function UnreadDot() {
  return <span className="inline-block h-2 w-2 rounded-full bg-brand-fill" role="img" aria-label="Unread" />;
}
