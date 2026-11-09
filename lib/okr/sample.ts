// Made-up OKR data shaped like the FY27 OKR Sheet (Objective > KR > Initiative, with baseline, target and current),
// so the picker, chips and reports can be built and tried without importing anything real. Names, numbers and
// wording here are invented. Replace it by syncing the real Sheet in Preferences > OKRs.
import { mergeParsed, parseOkrTab } from "./parse";
import { INITIATIVE_ROWS, OKR_ROWS } from "./sampleRows";
import type { OkrMirror } from "./types";

export function sampleMirror(by = "sample data"): OkrMirror {
  const parsed = mergeParsed([parseOkrTab("Sample", OKR_ROWS), parseOkrTab("Sample", INITIATIVE_ROWS)]);
  return {
    sourceId: "sample",
    syncedAt: new Date().toISOString(),
    syncedBy: by,
    sample: true,
    tabs: ["Sample"],
    krs: parsed.krs,
    initiatives: parsed.initiatives,
    warnings: parsed.warnings,
  };
}
