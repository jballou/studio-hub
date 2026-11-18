// Brand library data. Exported from Figma by scripts/export-brand.mjs into public/library (behind sign-in).
import { useEffect, useState } from "react";

export type BrandIcon = { name: string; vb: string; svg: string };
export type Logo = { id: string; brand: string; kind: string; variant: string; path: string; w: number | null; h: number | null };
export type Shade = { name: string; step: number; hex: string; rgb: string; cmyk: string; pms: string };
export type ColorFamily = { name: string; shades: Shade[] };

const cache = new Map<string, Promise<unknown>>();
function load<T>(file: string): Promise<T> {
  let p = cache.get(file);
  if (!p) {
    p = fetch(`/library/${file}`).then((r) => { if (!r.ok) throw new Error(`Couldn't load ${file}`); return r.json(); });
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p as Promise<T>;
}

/** Loads a library file once per page load. `data` stays null until it arrives; `error` is set if it can't be read. */
function useLibrary<T, R>(file: string, pick: (j: T) => R): { data: R | null; error: boolean } {
  const [state, setState] = useState<{ data: R | null; error: boolean }>({ data: null, error: false });
  useEffect(() => {
    let live = true;
    load<T>(file).then((j) => { if (live) setState({ data: pick(j), error: false }); }).catch(() => { if (live) setState({ data: null, error: true }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  return state;
}

export const useIcons = () => useLibrary<{ icons: BrandIcon[] }, BrandIcon[]>("icons.json", (j) => j.icons);
export const useLogos = () => useLibrary<{ logos: Logo[] }, Logo[]>("logos.json", (j) => j.logos);
export const useColors = () => useLibrary<{ families: ColorFamily[] }, ColorFamily[]>("colors.json", (j) => j.families);

/** Complete SVG document for an icon at a size and color. */
export function iconSvg(i: BrandIcon, size: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${i.vb}" fill="none">${i.svg.replace(/currentColor/g, color)}</svg>`;
}

/** Type scale from the Figma text styles (National 2). */
export const TYPE_SCALE: { name: string; weight: number; size: number; line: number; sample: string }[] = [
  { name: "Display Large", weight: 700, size: 132, line: 132, sample: "Curiosity" },
  { name: "Display Medium", weight: 700, size: 112, line: 112, sample: "Curiosity" },
  { name: "Display Small", weight: 700, size: 92, line: 92, sample: "Curiosity" },
  { name: "Headline Large", weight: 700, size: 76, line: 76, sample: "Ask better questions" },
  { name: "Headline Medium", weight: 700, size: 60, line: 60, sample: "Ask better questions" },
  { name: "Headline Small", weight: 700, size: 48, line: 56, sample: "Ask better questions" },
  { name: "Title Large", weight: 700, size: 36, line: 43, sample: "Turn answers into action" },
  { name: "Title Medium", weight: 700, size: 28, line: 36, sample: "Turn answers into action" },
  { name: "Title Small", weight: 700, size: 24, line: 32, sample: "Turn answers into action" },
  { name: "Label Eyebrow Large", weight: 500, size: 18, line: 22, sample: "Eyebrow label" },
  { name: "Label Eyebrow Medium", weight: 500, size: 16, line: 19, sample: "Eyebrow label" },
  { name: "Label Eyebrow Small", weight: 500, size: 14, line: 17, sample: "Eyebrow label" },
  { name: "Label Large", weight: 700, size: 16, line: 19, sample: "Button label" },
  { name: "Label Medium", weight: 700, size: 14, line: 24, sample: "Button label" },
  { name: "Label Small", weight: 700, size: 12, line: 20, sample: "Button label" },
  { name: "Body Large", weight: 400, size: 24, line: 38, sample: "Great decisions start with great questions." },
  { name: "Body Medium", weight: 400, size: 18, line: 29, sample: "Great decisions start with great questions." },
  { name: "Body Small", weight: 400, size: 16, line: 26, sample: "Great decisions start with great questions." },
  { name: "Body ExtraSmall", weight: 400, size: 14, line: 24, sample: "Great decisions start with great questions." },
];
