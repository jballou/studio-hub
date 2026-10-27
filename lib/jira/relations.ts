import type { IssueRef, LinkKind, LinkRef, Relations } from "@/lib/types";
import { getIssueFields, searchIssues, type JiraAuth, type JiraIssue } from "./client";
import { PROJECT_KEY } from "./map";

const REF_FIELDS = ["summary", "status", "issuetype", "parent"];

type Raw = {
  key: string;
  fields?: { summary?: string; status?: { name: string; statusCategory?: { key: string } }; issuetype?: { name: string; hierarchyLevel?: number } };
};

export function toRef(i: Raw): IssueRef {
  const f = i.fields ?? {};
  const cat = f.status?.statusCategory?.key;
  return {
    key: i.key,
    title: f.summary ?? i.key,
    typeName: f.issuetype?.name ?? "Issue",
    level: f.issuetype?.hierarchyLevel ?? 0,
    status: f.status?.name ?? "",
    statusCategory: cat === "done" ? "done" : cat === "new" ? "new" : "indeterminate",
    inHub: i.key.startsWith(`${PROJECT_KEY}-`),
  };
}

type RawLink = { type?: { name?: string; inward?: string; outward?: string }; inwardIssue?: Raw; outwardIssue?: Raw };

/**
 * Jira keeps one record per link on both tickets. `inwardIssue` present means the other ticket is on the inward side,
 * so this ticket's relation to it is the type's *inward* wording ("is blocked by"); `outwardIssue` uses the outward one.
 * Clones are skipped on purpose.
 */
export function linksFrom(links: RawLink[] | null | undefined): LinkRef[] {
  const out: LinkRef[] = [];
  for (const l of links ?? []) {
    const other = l.inwardIssue ?? l.outwardIssue;
    if (!other) continue;
    const typeName = l.type?.name ?? "";
    if (/clon/i.test(typeName)) continue;
    const inward = !!l.inwardIssue;
    const label = (inward ? l.type?.inward : l.type?.outward) ?? typeName;
    let kind: LinkKind = "other";
    if (/block/i.test(typeName)) kind = inward ? "blockedBy" : "blocks";
    else if (/relat/i.test(typeName)) kind = "related";
    out.push({ ...toRef(other), kind, label });
  }
  return out;
}

const ORDER: Record<LinkKind, number> = { blockedBy: 0, blocks: 1, related: 2, other: 3 };

/** Parents (up to two levels), children with their sub-tasks, and links, read with the viewer's own Jira permissions. */
export async function loadRelations(a: JiraAuth, key: string): Promise<Relations> {
  const self = await getIssueFields(a, key, ["parent", "issuelinks", "issuetype"]);
  const links = linksFrom(self.fields.issuelinks as RawLink[] | undefined).sort((x, y) => ORDER[x.kind] - ORDER[y.kind] || x.key.localeCompare(y.key));

  const ancestors: IssueRef[] = [];
  let p: JiraIssue["fields"]["parent"] = self.fields.parent;
  for (let depth = 0; p && depth < 2; depth++) {
    ancestors.unshift(toRef(p as Raw));
    p = depth === 0 ? (await getIssueFields(a, p.key, ["parent"]).catch(() => null))?.fields.parent : null;
  }

  // A sub-task can't have children, so skip those two searches for it.
  const isSubtask = (self.fields.issuetype?.hierarchyLevel ?? 0) < 0;
  const kids = isSubtask ? [] : await searchIssues(a, `parent = ${key} ORDER BY created ASC`, REF_FIELDS, 50).catch(() => []);
  const subs = kids.length ? await searchIssues(a, `parent in (${kids.map((k) => k.key).join(",")}) ORDER BY created ASC`, REF_FIELDS, 100).catch(() => []) : [];
  const children = kids.map((k) => ({ ...toRef(k), subtasks: subs.filter((s) => s.fields.parent?.key === k.key).map(toRef) }));

  return { ancestors, children, links };
}
