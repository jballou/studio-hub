import type { Project, Relations } from "@/lib/types";
import type { ProjectsRepo } from "./projects";

/** Browser-side adapter: talks to our own /api/jira routes, which call Jira with the user's token. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Tells the page "this is an older copy because Jira is busy", so it can say so. */
export const STALE_EVENT = "jira-stale";

async function get<T>(url: string, tries = 0): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    // Hard navigation on purpose: a full page load sends the user through the server-side sign-in.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Not signed in.");
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) {
    // Jira said slow down. Wait as long as it asked (at most 8 seconds), try again twice, then give a plain message.
    if (tries < 2) {
      await sleep(Math.min(Math.max(Number(body.retryAfter) || 3, 1), 8) * 1000);
      return get<T>(url, tries + 1);
    }
    throw new Error("Jira is busy right now. Give it a minute and try again.");
  }
  if (res.status >= 500 && tries < 1) {
    // A passing hiccup on Jira's side or ours: one quiet retry before showing an error.
    await sleep(1500);
    return get<T>(url, tries + 1);
  }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  if (body.stale && typeof window !== "undefined") window.dispatchEvent(new Event(STALE_EVENT));
  return body as T;
}

export const jiraProjects: ProjectsRepo = {
  // viewerId is ignored: the server knows who is signed in.
  async listProjects(_viewerId, scope = "all", group = "all", limit) {
    return (await get<{ projects: Project[] }>(`/api/jira/projects?scope=${scope}&group=${group}${limit ? `&limit=${limit}` : ""}`)).projects;
  },
  async closedWork(range) {
    const b = await get<{ projects: Project[]; truncated: boolean }>(`/api/jira/analytics?range=${range}`);
    return { projects: b.projects, truncated: b.truncated };
  },
  async assign(jiraKey, accountId) {
    const res = await fetch(`/api/jira/projects/${encodeURIComponent(jiraKey)}/assignee`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't assign it (${res.status}).`);
  },
  async searchProjects(_viewerId, query, limit = 8) {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    return (await get<{ projects: Project[] }>(`/api/jira/projects?${qs}`)).projects;
  },
  async myBriefs() {
    return (await get<{ projects: Project[] }>("/api/jira/briefs")).projects;
  },
  async relations(jiraKey) {
    try {
      return (await get<{ relations: Relations }>(`/api/jira/projects/${encodeURIComponent(jiraKey)}/relations`)).relations;
    } catch {
      return null;
    }
  },
  async setStartDate(jiraKey, date) {
    const res = await fetch(`/api/jira/projects/${encodeURIComponent(jiraKey)}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't save the start date (${res.status}).`);
  },
  async setDueDate(jiraKey, date) {
    const res = await fetch(`/api/jira/projects/${encodeURIComponent(jiraKey)}/due`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't save the due date (${res.status}).`);
  },
  async setKr(jiraKey, kr) {
    const res = await fetch(`/api/jira/projects/${encodeURIComponent(jiraKey)}/kr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kr }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't save the KR (${res.status}).`);
  },
  async moveTo(jiraKey, status) {
    const res = await fetch(`/api/jira/projects/${encodeURIComponent(jiraKey)}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.reason ?? body.error ?? `Couldn't move it (${res.status}).`);
  },
  async myWork() {
    return (await get<{ projects: Project[] }>("/api/jira/mine")).projects;
  },
  async getProject(jiraKey) {
    try {
      return (await get<{ project: Project }>(`/api/jira/projects/${encodeURIComponent(jiraKey)}`)).project;
    } catch (e) {
      if (e instanceof Error && /not found/i.test(e.message)) return null;
      throw e;
    }
  },
  async createBrief(input) {
    const res = await fetch("/api/jira/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't send the brief (${res.status}).`);
    return { jiraKey: body.key as string };
  },
};
