import type { Person } from "@/lib/types";
import { isJira } from "./mode";
import { mockRepo } from "./mock";

export interface PeopleRepo {
  /** Type-ahead search by name or email. */
  search(query: string, limit?: number): Promise<Person[]>;
}

// Everyone the UI has seen this session, so @mentions can be highlighted without another lookup.
const known = new Map<string, Person>();
const remember = (people: Person[]) => people.forEach((p) => known.set(p.id, p));
export const knownPeople = () => [...known.values()];

const mockPeople: PeopleRepo = {
  async search(q, limit = 8) {
    const t = q.trim().toLowerCase();
    const users = await mockRepo.listUsers();
    const out = users.filter((u) => !t || u.name.toLowerCase().includes(t)).slice(0, limit).map((u) => ({ id: u.id, name: u.name }));
    remember(out);
    return out;
  },
};

const jiraPeople: PeopleRepo = {
  async search(q, limit = 8) {
    if (!q.trim()) return [];
    const res = await fetch(`/api/jira/people?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't search people (${res.status}).`);
    const out = (body.people as Person[]).slice(0, limit);
    remember(out);
    return out;
  },
};

export const peopleRepo: PeopleRepo = isJira ? jiraPeople : mockPeople;
