// How a ticket records which KR its work supports: a Jira label. Pure, so the browser and the server share it.
export const KR_LABEL_RE = /^kr-[0-9a-f]{8}$/;
/** "Not tied to a KR (business as usual)". Counts as tagged, so it stops showing up as missing. */
export const NO_KR_LABEL = "kr-none";

export type KrTag = { krId?: string; none?: boolean };

export function krFromLabels(labels: readonly string[] | undefined): KrTag {
  const ls = (labels ?? []).map((l) => l.toLowerCase());
  const id = ls.find((l) => KR_LABEL_RE.test(l));
  if (id) return { krId: id };
  return ls.includes(NO_KR_LABEL) ? { none: true } : {};
}

export const isKrLabel = (l: string) => KR_LABEL_RE.test(l.toLowerCase()) || l.toLowerCase() === NO_KR_LABEL;
