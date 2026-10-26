import { parseCSV, parseDate, parseTime, isoDate } from "./csv";
import type { CalStatus, CalendarItem, CalendarSource, ItemType, SourceResult } from "./types";
import { STATUSES } from "./types";

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header synonyms (compared as lowercase letters+digits). First match wins. Extends the social calendar's set. */
const COLUMNS = {
  date: ["publishdate", "postdate", "date", "launchdate", "eventdate", "startdate", "releasedate", "scheduleddate", "publishon", "livedate", "golivedate"],
  endDate: ["enddate", "end", "through"],
  due: ["creativeduedate", "duedate", "assetduedate"],
  time: ["time", "posttime", "publishtime", "starttime", "scheduledtime"],
  category: ["eventtype", "category", "kind", "itemtype", "activitytype"],
  channel: ["channel", "platform", "network", "socialnetwork"],
  title: ["contenttitle", "title", "name", "eventname", "campaignname", "initiative", "postname", "post", "headline", "activity"],
  description: ["contentdescriptionfocus", "description", "notes", "summary", "caption", "copy", "details"],
  owner: ["productionlead", "owner", "assignee", "assignedto", "lead", "dri", "pm", "author"],
  campaign: ["launchphase", "campaign", "program", "theme"],
  status: ["status", "stage", "state", "workflowstatus"],
  link: ["assetlink", "asset", "link", "url", "creativelink"],
  jira: ["jirakey", "ticketkey", "jiraid", "jiraticket", "jiraissue", "jiratask", "jira", "ticket"],
} as const;

type Field = keyof typeof COLUMNS;

const STATUS_ALIASES: Record<string, CalStatus> = {
  idea: "Idea", backlog: "Idea", planned: "Idea", todo: "Idea", concept: "Idea", tbd: "Idea", proposed: "Idea",
  drafting: "Drafting", draft: "Drafting", inprogress: "Drafting", wip: "Drafting", writing: "Drafting", increative: "Drafting", planning: "Drafting",
  needsreview: "Needs Review", review: "Needs Review", inreview: "Needs Review", pendingapproval: "Needs Review", approval: "Needs Review",
  scheduled: "Scheduled", ready: "Scheduled", approved: "Scheduled", queued: "Scheduled", confirmed: "Scheduled",
  published: "Published", posted: "Published", live: "Published", launched: "Published", done: "Published", complete: "Published", completed: "Published", closed: "Published",
};

const TYPE_ALIASES: Record<string, ItemType> = {
  social: "social", socialpost: "social", post: "social",
  campaign: "campaign", campaignlaunch: "campaign", launch: "campaign",
  pr: "pr", press: "pr", media: "pr", pressrelease: "pr", announcement: "pr",
  event: "event", webinar: "event", conference: "event", tradeshow: "event", meetup: "event",
  product: "product", productlaunch: "product", release: "product", feature: "product", featurelaunch: "product",
};

const PLATFORM_ALIASES: Record<string, string> = {
  linkedin: "LinkedIn", li: "LinkedIn", instagram: "Instagram", ig: "Instagram", reddit: "Reddit",
  x: "X", twitter: "X", facebook: "Facebook", fb: "Facebook", tiktok: "TikTok", youtube: "YouTube", yt: "YouTube",
  threads: "Threads", pinterest: "Pinterest", bluesky: "Bluesky", email: "Email", newsletter: "Email", blog: "Blog",
};

const JIRA_KEY = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;

function normStatus(v: string): CalStatus | null {
  const k = norm(v);
  if (!k) return null;
  return STATUS_ALIASES[k] ?? STATUSES.find((s) => norm(s) === k) ?? null;
}

export function deriveStatus(date: string | null, dueDate: string | undefined, today: string): CalStatus {
  if (!date) return "Idea";
  if (date < today) return "Published";
  if (dueDate && dueDate >= today) return "Drafting";
  if (dueDate) return "Scheduled";
  const days = Math.round((+new Date(date) - +new Date(today)) / 864e5);
  return days > 14 ? "Idea" : "Scheduled";
}

function cleanCampaign(v: string): string {
  let t = v.replace(/^\s*\\?\[merged\\?\]\s*/i, "").trim();
  if (/\n/.test(v) || /merged/i.test(v)) t = t.split(/\n/)[0].replace(/\s*\(.*\)\s*$/, "").trim();
  return t;
}

/**
 * Turns a CSV into calendar items. Header rows are found automatically (first 15 rows),
 * merged "campaign" cells are filled down, and a social row listing several channels
 * becomes one item per channel. Rows without a usable date are skipped and counted.
 */
export function ingestSheet(text: string, src: CalendarSource, now: Date = new Date()): SourceResult {
  const loadedAt = new Date().toISOString();
  const today = isoDate(now);
  const base = { sourceId: src.id, loadedAt };
  const rows = parseCSV(text);
  if (!rows.length) return { ...base, items: [], warnings: [], error: "The sheet is empty." };

  const synSet = new Set<string>(Object.values(COLUMNS).flat());
  let hi = rows.slice(0, 15).findIndex((r) => r.filter((c) => synSet.has(norm(c))).length >= 2);
  if (hi < 0) hi = 0;
  const headers = rows[hi].map((h) => h.trim());
  const idx: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(COLUMNS) as Field[]) {
    const i = (COLUMNS[field] as readonly string[]).map((s) => headers.findIndex((h) => norm(h) === s)).find((j) => j >= 0);
    if (i !== undefined) idx[field] = i;
  }
  if (idx.date === undefined) {
    return { ...base, items: [], warnings: [], error: `No date column found. Expected a header like “Date”, “Publish Date” or “Launch Date”. Found: ${headers.filter(Boolean).join(", ")}` };
  }
  if (idx.title === undefined) {
    return { ...base, items: [], warnings: [], error: `No title column found. Expected a header like “Title” or “Name”. Found: ${headers.filter(Boolean).join(", ")}` };
  }

  const cell = (r: string[], f: Field, keepNL = false) => {
    const i = idx[f];
    const v = i === undefined ? "" : String(r[i] ?? "");
    return keepNL ? v.replace(/\r/g, "").trim() : v.replace(/\s+/g, " ").trim();
  };

  const items: CalendarItem[] = [];
  const warnings: string[] = [];
  let lastCampaign = "";
  let noDate = 0;
  let anyStatus = false;
  rows.slice(hi + 1).forEach((r, ri) => {
    if (idx.campaign !== undefined && String(r[idx.campaign] ?? "").trim()) lastCampaign = cleanCampaign(String(r[idx.campaign]));
    const title = cell(r, "title");
    const dateRaw = cell(r, "date");
    if (!title && !dateRaw) return;
    const date = parseDate(dateRaw, now);
    if (!date) { noDate++; return; }
    const catRaw = cell(r, "category");
    const type: ItemType = (catRaw && TYPE_ALIASES[norm(catRaw)]) || src.defaultType;
    const channels = type === "social" ? cell(r, "channel").split(/\s*(?:,|\/|&|\+|\band\b|;)\s*/i).filter(Boolean) : [cell(r, "channel")].filter(Boolean);
    const list = channels.length ? channels : [""];
    const statusRaw = normStatus(cell(r, "status"));
    if (statusRaw) anyStatus = true;
    const dueDate = parseDate(cell(r, "due"), now) ?? undefined;
    const linkCell = cell(r, "link");
    const key = (`${cell(r, "jira")} ${linkCell}`.match(JIRA_KEY) || [""])[0];
    list.forEach((ch, k) => {
      items.push({
        id: `${src.id}:${hi + 2 + ri}${k ? `-${k}` : ""}`,
        type,
        title: title || "(untitled)",
        date,
        endDate: parseDate(cell(r, "endDate"), now) ?? undefined,
        time: parseTime(cell(r, "time")) ?? parseTime(dateRaw.replace(/^\D*\d{1,2}[/.-]\d{1,2}[/.-]?\d{0,4}/, "")),
        status: statusRaw ?? deriveStatus(date, dueDate, today),
        statusDerived: !statusRaw,
        owner: cell(r, "owner") || "Unassigned",
        campaign: lastCampaign || "",
        channel: ch ? PLATFORM_ALIASES[norm(ch)] ?? ch : undefined,
        description: cell(r, "description", true),
        dueDate,
        link: /^https?:\/\//i.test(linkCell) ? linkCell : undefined,
        jiraKey: key || undefined,
        sourceId: src.id,
        sourceName: src.name,
        sourceRef: `Row ${hi + 2 + ri}`,
      });
    });
  });
  if (noDate) warnings.push(`${noDate} row${noDate > 1 ? "s" : ""} skipped: no valid date.`);
  if (!anyStatus && items.length) warnings.push("No Status column found, so statuses are inferred from dates.");
  return { ...base, items, warnings };
}
