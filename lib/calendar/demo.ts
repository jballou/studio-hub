import { isoDate } from "./csv";
import type { CalendarItem } from "./types";

const off = (base: Date, days: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return isoDate(d);
};

/** Demo sheet in the social plan's shape. Dates are relative to today so every view has content. */
export function demoSocialCsv(now = new Date()): string {
  const rows: [number, number | null, string, string, string, string, string, string][] = [
    [2, -2, "LinkedIn, Instagram", "Announcing the Trends 2027 report", "Launch teaser post with registration link.", "Maya Lin", "Trends 2027", "MKTGCRTV-201"],
    [5, 1, "LinkedIn", "Report stat spotlight: customer trust", "Single stat card, link to the report.", "Maya Lin", "Trends 2027", "MKTGCRTV-202"],
    [9, 4, "Instagram", "Behind the scenes: building the report", "Short vertical cut of the team at work.", "Jordan Reyes", "Trends 2027", "MKTGCRTV-203"],
    [13, 8, "Reddit", "AMA: what we learned from 10,000 responses", "Thread opener for the AMA.", "Jordan Reyes", "Trends 2027", ""],
    [-4, -9, "LinkedIn", "Customer story: from spreadsheets to insight", "Case study carousel.", "Maya Lin", "Customer stories", "MKTGCRTV-190"],
  ];
  const head = "Launch Phase,Publish Date,Creative Due Date,Channel,Content Title,Content Description / Focus,Production Lead,Jira Task";
  const body = rows.map(([d, due, ch, title, desc, owner, phase, key]) =>
    [phase, off(now, d), due == null ? "N/A" : off(now, due), `"${ch}"`, title, `"${desc}"`, owner, key].join(","));
  return [head, ...body].join("\n");
}

/** Demo tracker with a Category column mixing types, like a PR/events/launch tracker would. */
export function demoLaunchCsv(now = new Date()): string {
  const rows: [number, number | null, string, string, string, string, string, string][] = [
    [3, null, "Product launch", "AI analysis in Surveys", "GA release of AI-assisted analysis.", "Priya Shah", "Q4 launch", "Scheduled"],
    [7, 9, "PR", "Press embargo lifts: Trends 2027", "Embargoed briefings go live.", "Sam Okafor", "Trends 2027", "Scheduled"],
    [11, 12, "Event", "Webinar: Designing surveys people finish", "Live webinar, 11am PT.", "Dana Cole", "Q4 events", "Confirmed"],
    [16, 18, "Event", "Research Summit (SF)", "Booth and two sessions.", "Dana Cole", "Q4 events", "Planning"],
    [20, null, "Campaign launch", "Holiday pricing campaign", "Paid, email and social go live together.", "Lee Park", "Holiday", "Drafting"],
    [-5, -3, "PR", "Executive byline: future of feedback", "Placed in trade press.", "Sam Okafor", "Thought leadership", "Published"],
    [26, null, "Product launch", "Template gallery refresh", "New templates and search.", "Priya Shah", "Q4 launch", "Idea"],
  ];
  const head = "Launch Date,End Date,Category,Name,Notes,Owner,Program,Status";
  const body = rows.map(([d, end, cat, name, notes, owner, prog, status]) =>
    [off(now, d), end == null ? "" : off(now, end), cat, name, `"${notes}"`, owner, prog, status].join(","));
  return [head, ...body].join("\n");
}

/** Mock of what a Jira source (JQL + date field) will return once Atlassian sign-in is wired. */
export function demoJiraItems(now = new Date()): CalendarItem[] {
  const mk = (n: number, days: number, title: string, status: CalendarItem["status"], type: CalendarItem["type"], owner: string, campaign: string): CalendarItem => ({
    id: `jira-mktgcrtv:MKTGCRTV-${n}`, type, title, date: off(now, days), status, statusDerived: false, owner, campaign,
    description: "", jiraKey: `MKTGCRTV-${n}`, sourceId: "jira-mktgcrtv", sourceName: "MKTGCRTV (Jira, sample)", sourceRef: `MKTGCRTV-${n}`,
  });
  return [
    mk(101, 4, "Spring campaign: social ad", "Needs Review", "social", "Avery Chen", "Spring"),
    mk(102, 10, "Product teaser (15s)", "Drafting", "social", "Sam Okafor", "AI analysis"),
    mk(103, 14, "Brand one-pager", "Needs Review", "other", "Sam Okafor", "Brand"),
    mk(110, 22, "Webinar landing page refresh", "Idea", "campaign", "Jordan Patel", "Q4 events"),
  ];
}
