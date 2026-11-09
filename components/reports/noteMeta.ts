import type { NoteType } from "@/lib/me/types";

export const NOTE_TYPES: { id: NoteType; label: string; hint: string }[] = [
  { id: "win", label: "Win", hint: "Something that went well" },
  { id: "loss", label: "Miss", hint: "Something that didn't land" },
  { id: "blocker", label: "Blocker", hint: "What's in the way" },
  { id: "opportunity", label: "Opportunity", hint: "Something we should do" },
  { id: "growth", label: "Growth", hint: "Feedback or something you learned" },
  { id: "one_on_one", label: "1:1 topic", hint: "Something to raise with your manager" },
  { id: "gig", label: "GIG evidence", hint: "Proof for your yearly review" },
  { id: "other", label: "Other", hint: "Anything else" },
];
export const noteLabel = (t: NoteType) => NOTE_TYPES.find((x) => x.id === t)?.label ?? "Note";
