import { DEFAULT_SETTINGS, parseLookback, type Settings } from "@/lib/settings";
import { isJira } from "./mode";

export interface SettingsRepo {
  get(): Promise<Settings>;
  /** Admin only on the server. Rejects with a plain message. */
  save(patch: { projectLookbackDays: number }): Promise<Settings>;
}

const jiraSettings: SettingsRepo = {
  async get() {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) return DEFAULT_SETTINGS;
    return (await res.json()).settings;
  },
  async save(patch) {
    const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't save (${res.status}).`);
    return body.settings;
  },
};

// Demo mode keeps the setting in this browser so the screen can be tried. It doesn't change the demo project list.
const KEY = "hub-settings-demo-v1";
const demoSettings: SettingsRepo = {
  async get() {
    try { return { projectLookbackDays: parseLookback(JSON.parse(localStorage.getItem(KEY) ?? "{}").projectLookbackDays) ?? DEFAULT_SETTINGS.projectLookbackDays }; } catch { return DEFAULT_SETTINGS; }
  },
  async save(patch) {
    const days = parseLookback(patch.projectLookbackDays);
    if (days === null) throw new Error("Enter a whole number of days from 1 to 3650.");
    try { localStorage.setItem(KEY, JSON.stringify({ projectLookbackDays: days })); } catch { /* storage unavailable */ }
    return { projectLookbackDays: days };
  },
};

export const settingsRepo: SettingsRepo = isJira ? jiraSettings : demoSettings;
