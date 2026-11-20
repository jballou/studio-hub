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

export { TYPE_SCALE } from "./scale";
