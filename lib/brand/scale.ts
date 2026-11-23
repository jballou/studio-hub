/** Uses every letter of the alphabet, so each style shows its whole character set. Labels and eyebrows keep their short text. */
export const SENTENCE = "Curiosity makes brave explorers question how jazzy foxes vault giant hedges.";

/** Type scale from the Figma text styles (National 2). */
export const TYPE_SCALE: { name: string; weight: number; size: number; line: number; sample: string }[] = [
  { name: "Display Large", weight: 700, size: 132, line: 132, sample: SENTENCE },
  { name: "Display Medium", weight: 700, size: 112, line: 112, sample: SENTENCE },
  { name: "Display Small", weight: 700, size: 92, line: 92, sample: SENTENCE },
  { name: "Headline Large", weight: 700, size: 76, line: 76, sample: SENTENCE },
  { name: "Headline Medium", weight: 700, size: 60, line: 60, sample: SENTENCE },
  { name: "Headline Small", weight: 700, size: 48, line: 56, sample: SENTENCE },
  { name: "Title Large", weight: 700, size: 36, line: 43, sample: SENTENCE },
  { name: "Title Medium", weight: 700, size: 28, line: 36, sample: SENTENCE },
  { name: "Title Small", weight: 700, size: 24, line: 32, sample: SENTENCE },
  { name: "Label Eyebrow Large", weight: 500, size: 18, line: 22, sample: "Eyebrow label" },
  { name: "Label Eyebrow Medium", weight: 500, size: 16, line: 19, sample: "Eyebrow label" },
  { name: "Label Eyebrow Small", weight: 500, size: 14, line: 17, sample: "Eyebrow label" },
  { name: "Label Large", weight: 700, size: 16, line: 19, sample: "Button label" },
  { name: "Label Medium", weight: 700, size: 14, line: 24, sample: "Button label" },
  { name: "Label Small", weight: 700, size: 12, line: 20, sample: "Button label" },
  { name: "Body Large", weight: 400, size: 24, line: 38, sample: SENTENCE },
  { name: "Body Medium", weight: 400, size: 18, line: 29, sample: SENTENCE },
  { name: "Body Small", weight: 400, size: 16, line: 26, sample: SENTENCE },
  { name: "Body ExtraSmall", weight: 400, size: 14, line: 24, sample: SENTENCE },
];

/** Labels and eyebrows are short UI text, so they keep their own sample and ignore custom preview text. */
export const isShortStyle = (name: string) => name.startsWith("Label");

type Pairing = { use: string; eyebrow?: string; heading?: string; body?: string; label?: string };
const P = (use: string, eyebrow: string, body: string, label: string, heading?: string): Pairing => ({ use, eyebrow, body, label, heading });

/** What each style is for, and which other styles it sits with. Names match TYPE_SCALE. */
export const PAIRINGS: Record<string, Pairing> = {
  "Display Large": P("Campaign and hero statements of a few words. Too big for small screens, so step down to Display Small on phones.", "Label Eyebrow Large", "Body Large", "Label Large"),
  "Display Medium": P("Landing page heroes and big moments. Keep it to one or two lines.", "Label Eyebrow Large", "Body Large", "Label Large"),
  "Display Small": P("Section heroes and big numbers that need to land.", "Label Eyebrow Medium", "Body Large", "Label Large"),
  "Headline Large": P("Page titles and the main statement of a page.", "Label Eyebrow Medium", "Body Large", "Label Large"),
  "Headline Medium": P("Section headings on marketing and long pages.", "Label Eyebrow Medium", "Body Medium", "Label Large"),
  "Headline Small": P("Subsection headings and big card titles.", "Label Eyebrow Small", "Body Medium", "Label Medium"),
  "Title Large": P("Page headings inside the app and dialog titles.", "Label Eyebrow Small", "Body Medium", "Label Medium"),
  "Title Medium": P("Card and panel titles.", "Label Eyebrow Small", "Body Small", "Label Medium"),
  "Title Small": P("Small card titles, list headings and form sections.", "Label Eyebrow Small", "Body ExtraSmall", "Label Small"),
  "Label Eyebrow Large": P("A short line above a large heading. Use sparingly: the heading should carry itself.", "Label Eyebrow Large", "Body Large", "Label Large", "Headline Medium"),
  "Label Eyebrow Medium": P("A short line above a heading.", "Label Eyebrow Medium", "Body Medium", "Label Large", "Headline Small"),
  "Label Eyebrow Small": P("A short line above a card or section title.", "Label Eyebrow Small", "Body Small", "Label Medium", "Title Medium"),
  "Label Large": P("Primary buttons and the biggest controls.", "Label Eyebrow Medium", "Body Medium", "Label Large", "Headline Small"),
  "Label Medium": P("Standard buttons, tabs and menu items.", "Label Eyebrow Small", "Body Small", "Label Medium", "Title Medium"),
  "Label Small": P("Compact buttons, tags and chips.", "Label Eyebrow Small", "Body ExtraSmall", "Label Small", "Title Small"),
  "Body Large": P("Intro paragraphs and lead copy.", "Label Eyebrow Medium", "Body Large", "Label Large", "Headline Small"),
  "Body Medium": P("Default reading text on marketing pages.", "Label Eyebrow Small", "Body Medium", "Label Medium", "Title Large"),
  "Body Small": P("Default text in the app: descriptions and cards.", "Label Eyebrow Small", "Body Small", "Label Medium", "Title Medium"),
  "Body ExtraSmall": P("Captions, helper text and dense tables.", "Label Eyebrow Small", "Body ExtraSmall", "Label Small", "Title Small"),
};
