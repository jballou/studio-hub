import type { Person, Project } from "@/lib/types";
import { isJira } from "./mode";
import { mockProjects } from "./projects";

export interface TeamRepo {
  /** People who can be assigned work. */
  members(): Promise<Person[]>;
  /** Team leads only: one creative's Jira work ("person" is their account id), or everyone's together ("all"). Jira work only, never personal tasks or calendars. */
  work(person: string): Promise<{ members: Person[]; projects: Project[]; stale?: boolean }>;
}

const real: TeamRepo = {
  async work(person) {
    const res = await fetch(`/api/team/work?person=${encodeURIComponent(person)}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't load the team's work (${res.status}).`);
    return body;
  },
  async members() {
    const res = await fetch("/api/team", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
    return body.members as Person[];
  },
};

const MOCK_MEMBERS: Person[] = [{ id: "u-avery", name: "Avery Chen" }, { id: "u-sam", name: "Sam Okafor" }, { id: "u-casey", name: "Casey Lin" }];

const mock: TeamRepo = {
  async work(person) {
    const all = await mockProjects.listProjects("u-avery", "all", "all");
    return { members: MOCK_MEMBERS, projects: all.filter((p) => p.assigneeId && (person === "all" ? MOCK_MEMBERS.some((m) => m.id === p.assigneeId) : p.assigneeId === person)) };
  },
  members: async () => MOCK_MEMBERS,
};

export const teamRepo: TeamRepo = isJira ? real : mock;
