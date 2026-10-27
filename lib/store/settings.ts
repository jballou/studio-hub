import { DEFAULT_SETTINGS, parseLookback, type Settings } from "@/lib/settings";
import { readDoc, updateDoc } from "./doc";
import { AdminError, audit } from "./users";

let cache: { at: number; data: Settings } | null = null;
const TTL_MS = 15_000;

const merge = (raw: Partial<Settings> | undefined): Settings => ({
  projectLookbackDays: parseLookback(raw?.projectLookbackDays) ?? DEFAULT_SETTINGS.projectLookbackDays,
});

/** Current settings. Falls back to the defaults if the store can't be read, so project lists never break over this. */
export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const { data } = await readDoc<Partial<Settings>>("settings", () => ({}));
    cache = { at: Date.now(), data: merge(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
  return cache.data;
}

export async function updateSettings(actor: string, patch: { projectLookbackDays?: unknown }): Promise<Settings> {
  const days = patch.projectLookbackDays === undefined ? undefined : parseLookback(patch.projectLookbackDays);
  if (patch.projectLookbackDays !== undefined && days === null) throw new AdminError(400, "Enter a whole number of days from 1 to 3650.");
  const before = await getSettings();
  const next = await updateDoc<Partial<Settings>, Settings>("settings", () => ({}), (d) => {
    const m = merge({ ...d, ...(days !== undefined ? { projectLookbackDays: days! } : {}) });
    return { data: m, result: m };
  });
  cache = null;
  if (next.projectLookbackDays !== before.projectLookbackDays) {
    await audit({ actor, action: "settings.update", target: "projectLookbackDays", detail: `${before.projectLookbackDays} to ${next.projectLookbackDays} days` });
  }
  return next;
}
