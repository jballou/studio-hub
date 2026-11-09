import { GoogleError, sheetValues } from "@/lib/google/client";
import { mergeParsed, parseOkrTab } from "@/lib/okr/parse";
import { sampleMirror } from "@/lib/okr/sample";
import type { OkrConfig, OkrMirror } from "@/lib/okr/types";
import { readDoc, updateDoc } from "./doc";
import { AdminError, audit } from "./users";

// The OKR mirror: one shared, read-only copy of the FY27 OKR Sheet. It holds company goals, not personal data.
// Only an admin can point it at a Sheet or refresh it; the Sheet itself stays the source of truth.
const MAX_TABS = 8;

const emptyConfig = (): OkrConfig => ({ spreadsheetId: process.env.OKR_SHEET_ID ?? "", tabs: ["Marketing"] });
const emptyMirror = (): { mirror: OkrMirror | null } => ({ mirror: null });

export async function getOkrConfig(): Promise<OkrConfig> {
  return (await readDoc("okr/config", emptyConfig)).data;
}

export async function getOkrMirror(): Promise<OkrMirror | null> {
  return (await readDoc("okr/mirror", emptyMirror)).data.mirror;
}

/** Accepts a full Google Sheets link or a bare id. */
export function sheetIdFrom(input: string): string | null {
  const t = input.trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(t);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(t) ? t : null;
}

export async function setOkrConfig(actor: string, input: { sheet?: unknown; tabs?: unknown }): Promise<OkrConfig> {
  const id = sheetIdFrom(String(input.sheet ?? ""));
  if (!id) throw new AdminError(400, "Paste the link to the OKR Google Sheet.");
  const tabs = (Array.isArray(input.tabs) ? input.tabs : [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, MAX_TABS);
  if (!tabs.length) throw new AdminError(400, "Name at least one tab to read.");
  if (tabs.some((t) => t.length > 100)) throw new AdminError(400, "A tab name is too long.");
  const next: OkrConfig = { spreadsheetId: id, tabs };
  await updateDoc("okr/config", emptyConfig, () => ({ data: next, result: undefined }));
  await audit({ actor, action: "okr.config", target: "okr", detail: tabs.join(", ") });
  return next;
}

/** Reads the configured tabs with the admin's own Google connection and replaces the mirror. */
export async function syncOkr(adminEmail: string): Promise<OkrMirror> {
  const cfg = await getOkrConfig();
  if (!cfg.spreadsheetId) throw new AdminError(400, "Set the OKR Sheet link first.");
  const ranges = cfg.tabs.map((t) => `'${t.replace(/'/g, "''")}'!A1:AF400`);
  let values: string[][][];
  try {
    values = await sheetValues(adminEmail, cfg.spreadsheetId, ranges);
  } catch (e) {
    if (e instanceof GoogleError && e.status === 502) throw new AdminError(502, "Couldn't read the Sheet. Check the link and that every tab name matches exactly.");
    throw e;
  }
  const parsed = mergeParsed(cfg.tabs.map((t, i) => parseOkrTab(t, values[i] ?? [])));
  const mirror: OkrMirror = {
    sourceId: cfg.spreadsheetId,
    syncedAt: new Date().toISOString(),
    syncedBy: adminEmail,
    tabs: cfg.tabs,
    krs: parsed.krs,
    initiatives: parsed.initiatives,
    warnings: parsed.warnings.slice(0, 50),
  };
  await updateDoc("okr/mirror", emptyMirror, () => ({ data: { mirror }, result: undefined }));
  await audit({ actor: adminEmail, action: "okr.sync", target: "okr", detail: `${mirror.krs.length} KRs, ${mirror.initiatives.length} initiatives` });
  return mirror;
}

/** Fills the mirror with made-up data shaped like the real Sheet. Refuses to overwrite a real sync. */
export async function loadSampleOkr(actor: string): Promise<OkrMirror> {
  const cur = await getOkrMirror();
  if (cur && !cur.sample) throw new AdminError(409, "Real OKR data is already synced. Sample data would overwrite it.");
  const mirror = sampleMirror(actor);
  await updateDoc("okr/mirror", emptyMirror, () => ({ data: { mirror }, result: undefined }));
  await audit({ actor, action: "okr.sample", target: "okr", detail: `${mirror.krs.length} sample KRs` });
  return mirror;
}
