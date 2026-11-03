import type { Tone } from "@/components/ui/Tag";
import type { CalStatus, ItemType } from "@/lib/calendar/types";

export const TYPE_TONE: Record<ItemType, Tone> = {
  social: "info", campaign: "ok", pr: "progress", event: "warn", product: "gold", other: "neutral", task: "progress",
};

/** Solid bar color per type (palette steps with 3:1+ on white), used as a chip accent beside the text label. */
export const TYPE_BAR: Record<ItemType, string> = {
  social: "var(--color-data-social)", campaign: "var(--color-data-ok)", pr: "var(--color-data-progress)", event: "var(--color-data-watch)", product: "var(--color-data-product)", other: "var(--color-data-other)", task: "var(--color-data-task)",
};

export const TYPE_SHORT: Record<ItemType, string> = {
  social: "Social", campaign: "Launch", pr: "PR", event: "Event", product: "Product", other: "Other", task: "Task",
};

export const STATUS_TONE: Record<CalStatus, Tone> = {
  Idea: "neutral", Drafting: "warn", "Needs Review": "info", Scheduled: "progress", Published: "ok",
};
