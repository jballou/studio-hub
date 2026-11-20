// Tools the Brand Creative bot can call to answer brand questions. They read the same library the Hub shows (public/library)
// and the Drive photo and illustration folders. Results are small facts plus a Hub link; the bot never sends files itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { driveSearch } from "@/lib/google/client";
import type { BrandIcon, ColorFamily, Logo } from "@/lib/brand/data";
import { TYPE_SCALE } from "@/lib/brand/scale";
import { getBrandConfig, inBrandTree, type BrandKind } from "@/lib/store/brand";

const lib = <T>(file: string): T => JSON.parse(readFileSync(join(process.cwd(), "public", "library", file), "utf8")) as T;
const terms = (q: string) => q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export function brandTools(base: string) {
  const link = (path: string) => `${base}${path}`;
  return {
    findIcons: tool({
      description: "Search the Hub icon library by name. Returns icon names; people can download them as SVG or PNG on the Icons page.",
      inputSchema: z.object({ query: z.string().describe("What the icon should show, e.g. 'calendar' or 'arrow'"), limit: z.number().int().min(1).max(12).optional() }),
      execute: async ({ query, limit = 8 }) => {
        const t = terms(query);
        const hits = lib<{ icons: BrandIcon[] }>("icons.json").icons.filter((i) => t.every((w) => i.name.includes(w))).slice(0, limit).map((i) => i.name);
        return { matches: hits, total: hits.length, page: link("/brand/icons") };
      },
    }),
    findLogos: tool({
      description: "List brand logo files. Brands: surveymonkey, launchpad, getfeedback. Kinds: primary, secondary, logomark (surveymonkey); primary, secondary, mark (launchpad); logo, symbol (getfeedback). Variants are colors such as green, black, white, muted, light, dark, periwinkle, color.",
      inputSchema: z.object({ brand: z.string().optional(), kind: z.string().optional(), variant: z.string().optional() }),
      execute: async ({ brand, kind, variant }) => {
        const m = lib<{ logos: Logo[] }>("logos.json").logos.filter((l) => (!brand || l.brand === brand.toLowerCase()) && (!kind || l.kind === kind.toLowerCase()) && (!variant || l.variant === variant.toLowerCase()));
        return { logos: m.map((l) => `${l.brand} ${l.kind} ${l.variant}`), page: link("/brand/logos") };
      },
    }),
    findColors: tool({
      description: "Look up brand colors. Returns hex, RGB, CMYK and Pantone for matching shades. Search by family (Green, Neutral, Periwinkle...) or a shade name like 'Green 500'.",
      inputSchema: z.object({ query: z.string().describe("A color family or shade, e.g. 'green' or 'Green 500'") }),
      execute: async ({ query }) => {
        const t = terms(query);
        const shades = lib<{ families: ColorFamily[] }>("colors.json").families.flatMap((f) => f.shades).filter((s) => t.every((w) => s.name.toLowerCase().includes(w)));
        return { shades: shades.slice(0, 12), more: Math.max(0, shades.length - 12), page: link("/brand/colors") };
      },
    }),
    typography: tool({
      description: "The brand typeface and its text styles (size, line height, weight).",
      inputSchema: z.object({}),
      execute: async () => ({ typeface: "National 2", styles: TYPE_SCALE.map((s) => ({ name: s.name, weight: s.weight, size: s.size, lineHeight: s.line })), page: link("/brand/type") }),
    }),
    findPhotos: tool({
      description: "Search the brand photo or illustration library (Google Drive) by file name. Returns names and where to browse.",
      inputSchema: z.object({ kind: z.enum(["photos", "illustrations"]), query: z.string().min(2) }),
      execute: async ({ kind, query }) => {
        const cfg = await getBrandConfig();
        if (!cfg[kind as BrandKind] || !cfg.owner) return { error: `The ${kind} library isn't set up yet.` };
        const found = await driveSearch(cfg.owner, query);
        const inside: string[] = [];
        for (const f of found) if (inside.length < 8 && (await inBrandTree(cfg, kind, f.id).catch(() => false))) inside.push(f.name);
        return { matches: inside, page: link(`/brand/${kind}`) };
      },
    }),
  };
}
