import type { Tone } from "@/components/ui/Tag";
import type { CalStatus, ItemType } from "@/lib/calendar/types";

export const TYPE_TONE: Record<ItemType, Tone> = {
  social: "info", campaign: "ok", pr: "progress", event: "warn", product: "gold", other: "neutral",
};

/** Solid bar color per type (palette steps with 3:1+ on white), used as a chip accent beside the text label. */
export const TYPE_BAR: Record<ItemType, string> = {
  social: "#5568bf", campaign: "#08794a", pr: "#348289", event: "#a95c18", product: "#a18102", other: "#686764",
};

export const TYPE_SHORT: Record<ItemType, string> = {
  social: "Social", campaign: "Launch", pr: "PR", event: "Event", product: "Product", other: "Other",
};

export const STATUS_TONE: Record<CalStatus, Tone> = {
  Idea: "neutral", Drafting: "warn", "Needs Review": "info", Scheduled: "progress", Published: "ok",
};
