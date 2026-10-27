import { isJira } from "./mode";

export type ActivityItem = { id: string; key: string; title: string; who: string; mine: boolean; what: string; at: string };

export interface ActivityRepo {
  recent(): Promise<ActivityItem[]>;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

const jiraActivity: ActivityRepo = {
  async recent() {
    const res = await fetch("/api/jira/activity", { cache: "no-store" });
    if (!res.ok) throw new Error("Couldn't load recent activity.");
    return (await res.json()).items;
  },
};

const demoActivity: ActivityRepo = {
  async recent() {
    return [
      { id: "1", key: "MKTGCRTV-101", title: "Spring campaign: social ad", who: "Riley Brooks", mine: false, what: "moved to In feedback", at: hoursAgo(1) },
      { id: "2", key: "MKTGCRTV-102", title: "Product teaser (15s)", who: "Jordan Patel", mine: false, what: "changed the due date", at: hoursAgo(3) },
      { id: "3", key: "MKTGCRTV-103", title: "Brand one-pager", who: "Avery Chen", mine: true, what: "assigned to Sam Okafor", at: hoursAgo(5) },
    ];
  },
};

export const activityRepo: ActivityRepo = isJira ? jiraActivity : demoActivity;
