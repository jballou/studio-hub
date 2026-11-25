import { DEFAULT_FLOW } from "./defaultFlow";
import type { Flow, Option, QNode } from "./flow";

// How an illustration is requested, from the Brand Creative team's intake Epic (MKTGCRTV-1457, "Illustration | Requests 2026"):
// look through the library first, then create a ticket connected to that Epic for a new or modified illustration.
/** The Epic every illustration request is created under. Update this when the team opens next year's Epic. */
export const ILLUSTRATION_EPIC = "MKTGCRTV-1457";

export const ILLUSTRATION_LINKS = {
  guidelines: "https://brand.surveymonkey.com/document/149#/visual-guidelines/illustration",
  slides: "https://docs.google.com/presentation/d/1EgqkkOaxEiop9hmJtLUSB05cy0kI8AqPEN2ocZvKADg/edit?usp=sharing",
  slack: "https://surveymonkey.slack.com/archives/C08GTG11GVD",
} as const;

// Illustration requests are filed as Graphic design tickets, found again by the illustration-request label.
const TYPE_OPTIONS: Option[] = [
  { id: "new", label: "A new illustration", jiraIssueTypeId: "18868", jiraLabel: "illustration-request" },
  { id: "edit", label: "A change to an existing illustration", jiraIssueTypeId: "18868", jiraLabel: "illustration-request" },
];

const node = (n: Omit<QNode, "field" | "required"> & { field?: string; required?: boolean }): QNode => ({ field: n.field ?? n.id, required: n.required ?? true, ...n });
const shared = (id: string) => DEFAULT_FLOW.nodes.find((n) => n.id === id)!;

export const ILLUSTRATION_FLOW: Flow = {
  version: 1,
  start: "type",
  nodes: [
    node({ id: "type", label: "Request type", prompt: "Is this a new illustration, or a change to one we already have?", help: "Modified and net-new illustrations are both welcome here.", qtype: "choice", options: TYPE_OPTIONS, next: "title" }),
    node({
      id: "title", label: "Title", prompt: "What should we call it?", help: "A short name, like “Survey results hero”.", qtype: "text", next: "i_what",
      branches: [{ when: { field: "type", op: "equals", value: "edit" }, goto: "i_existing" }],
    }),

    // A change to an existing illustration
    node({ id: "i_existing", label: "Existing illustration", prompt: "Which illustration from the library should we start from?", help: "Paste its link or file name.", qtype: "text", next: "i_changes" }),
    node({ id: "i_changes", label: "What needs to change", prompt: "What should change?", help: "Colors, elements, composition, size. The more specific, the better.", qtype: "longtext", next: "i_where" }),

    // A new illustration
    node({ id: "i_what", label: "What to illustrate", prompt: "Describe what you need illustrated.", help: "The idea or message, the subject, and the feeling it should give.", qtype: "longtext", next: "i_checked" }),
    node({ id: "i_checked", label: "Checked the library", prompt: "Have you looked through the Illustration Library for something that already fits?", help: "Existing, approved illustrations are the fastest route.", qtype: "yesno", next: "i_closest" }),
    node({ id: "i_closest", label: "Closest existing illustration", prompt: "Which existing illustration comes closest, and why doesn't it fit?", help: "If you haven't looked yet, start with the library on the Illustrations page, then come back and tell us.", qtype: "longtext", next: "i_where" }),

    node({ id: "i_where", label: "Where it will be used", prompt: "Where will “{{title}}” be used?", qtype: "multichoice", options: [..."Web,Product,Email,Slides or presentation,Social,Print,Other".split(",")].map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label })), next: "i_refs" }),
    node({ id: "i_refs", label: "References", prompt: "Any references, inspiration or related work?", help: "Links are fine. Our illustration usage guidelines apply to everything we make.", qtype: "longtext", required: false, next: "deadline" }),

    shared("deadline"), shared("d_firm"), shared("d_why"), shared("stakeholders"), shared("anything"),
  ],
};
