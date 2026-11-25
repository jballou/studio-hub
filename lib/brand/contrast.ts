/** WCAG 2 contrast maths and the brand's recommended text and background pairs, shared by the color cards and the contrast checker. */

// Text color that stays readable on a swatch: the first of off-white, brand ink or black that reaches 4.5:1 (WCAG AA),
// or whichever is best when none do.
const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
export const ratio = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
export const textOn = (hex: string) => {
  const options = ["#FEFDFB", "#0F2E21", "#000000"];
  return options.find((c) => ratio(c, hex) >= 4.5) ?? options.reduce((best, c) => (ratio(c, hex) > ratio(best, hex) ? c : best));
};

/** Parses #RGB or #RRGGBB (with or without the #) to upper-case #RRGGBB, or null. */
export function normalizeHex(v: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
}

export type Pair = [label: string, fg: string];
// Text colors that suit each background, from the brand's accessibility guidance in Figma. Ratios are worked out here from the hex values.
const D: Pair = ["Text color dark", "#0F2E21"], L: Pair = ["Text color light", "#FEFDFB"], MUTED: Pair = ["Text color muted", "#82807D"];
const BRAND: Pair = ["Text color brand", "#089B5E"], LINK: Pair = ["Hyperlink color", "#08794A"], LINK_LIGHT: Pair = ["Hyperlink color", "#D6F5DE"];
const AY6: Pair = ["Text color accent", "#A18102"], AP7: Pair = ["Text color accent", "#3F4D94"], AT7: Pair = ["Text color accent", "#348289"];
const AY4: Pair = ["Text color accent", "#E2BF36"], AP5: Pair = ["Text color accent", "#7084EB"], AT4: Pair = ["Text color accent", "#87D0D7"];
const LIGHT_SURFACE = [D, MUTED, BRAND, AY6, AP7, AT7, LINK];
export const COMBOS: { name: string; bg: string; text: Pair[] }[] = [
  { name: "Neutral 50", bg: "#FEFDFB", text: LIGHT_SURFACE },
  { name: "Neutral 150", bg: "#EDEBE8", text: LIGHT_SURFACE },
  { name: "Green 900", bg: "#0F2E21", text: [L, MUTED, BRAND, AY4, AP5, AT4, LINK_LIGHT] },
  { name: "Green 500", bg: "#089B5E", text: [L, D, LINK_LIGHT] },
  { name: "Yellow 100", bg: "#F9F2D2", text: LIGHT_SURFACE },
  { name: "Yellow 300", bg: "#EBD370", text: [D, LINK] },
  { name: "Periwinkle 100", bg: "#EDEDFD", text: LIGHT_SURFACE },
  { name: "Periwinkle 600", bg: "#5566BF", text: [L, LINK_LIGHT] },
  { name: "Teal 200", bg: "#C5E8EB", text: [D, MUTED, AP7, AT7, LINK] },
  { name: "Teal 400", bg: "#87D0D7", text: [D, LINK] },
];
export const grade = (r: number) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "Large text" : "Fails");

/** Every brand color used above, for the checker's quick picks. */
export const QUICK_PICKS: { name: string; hex: string }[] = [
  { name: "Neutral 50", hex: "#FEFDFB" }, { name: "Neutral 150", hex: "#EDEBE8" }, { name: "Neutral 550", hex: "#82807D" },
  { name: "Green 100", hex: "#D6F5DE" }, { name: "Green 500", hex: "#089B5E" }, { name: "Green 600", hex: "#08794A" }, { name: "Green 900", hex: "#0F2E21" },
  { name: "Yellow 100", hex: "#F9F2D2" }, { name: "Yellow 300", hex: "#EBD370" }, { name: "Yellow 400", hex: "#E2BF36" }, { name: "Yellow 600", hex: "#A18102" },
  { name: "Periwinkle 100", hex: "#EDEDFD" }, { name: "Periwinkle 500", hex: "#7084EB" }, { name: "Periwinkle 600", hex: "#5566BF" }, { name: "Periwinkle 700", hex: "#3F4D94" },
  { name: "Teal 200", hex: "#C5E8EB" }, { name: "Teal 400", hex: "#87D0D7" }, { name: "Teal 700", hex: "#348289" },
  { name: "Black", hex: "#000000" },
];
