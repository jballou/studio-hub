import type { Person } from "@/lib/types";
import { isJira } from "./mode";

export interface TeamRepo {
  /** People who can be assigned work. */
  members(): Promise<Person[]>;
}

const real: TeamRepo = {
  async members() {
    const res = await fetch("/api/team", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
    return body.members as Person[];
  },
};

const mock: TeamRepo = {
  members: async () => [{ id: "u-avery", name: "Avery Chen" }, { id: "u-sam", name: "Sam Okafor" }, { id: "u-casey", name: "Casey Lin" }],
};

export const teamRepo: TeamRepo = isJira ? real : mock;
