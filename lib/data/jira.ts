import type { Project } from "@/lib/types";
import type { ProjectsRepo } from "./projects";

/** Browser-side adapter: talks to our own /api/jira routes, which call Jira with the user's token. */
async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    // Hard navigation on purpose: a full page load sends the user through the server-side sign-in.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Not signed in.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const jiraProjects: ProjectsRepo = {
  // viewerId is ignored: the server knows who is signed in.
  async listProjects(_viewerId, scope = "all") {
    return (await get<{ projects: Project[] }>(`/api/jira/projects?scope=${scope}`)).projects;
  },
  async searchProjects(_viewerId, query, limit = 8) {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    return (await get<{ projects: Project[] }>(`/api/jira/projects?${qs}`)).projects;
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
  async createBrief(): Promise<{ jiraKey: string }> {
    throw new Error("Creating Jira tickets isn't connected yet. For now, create the ticket in Jira.");
  },
};
