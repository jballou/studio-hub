import { Icon, type IconName } from "./Icon";

/** Jira's hierarchy as icons: initiative > epic > task or story > sub-task. Color plus shape, and the type name is always in the tooltip. */
export function issueIcon(level: number, typeName = ""): { icon: IconName; tone: string; label: string } {
  if (level >= 2) return { icon: "initiative", tone: "text-gold-fg", label: typeName || "Initiative" };
  if (level === 1) return { icon: "epic", tone: "text-info-fg", label: typeName || "Epic" };
  if (level < 0) return { icon: "subtask", tone: "text-n-800", label: typeName || "Sub-task" };
  if (/story/i.test(typeName)) return { icon: "story", tone: "text-ok-fg", label: typeName };
  return { icon: "task", tone: "text-progress-fg", label: typeName || "Task" };
}

export function IssueIcon({ level, typeName, size = 16 }: { level: number; typeName?: string; size?: number }) {
  const i = issueIcon(level, typeName);
  return <span className={`inline-flex shrink-0 ${i.tone}`} title={i.label} role="img" aria-label={i.label}><Icon name={i.icon} size={size} /></span>;
}
