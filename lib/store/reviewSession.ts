import type { JiraSession } from "@/lib/jira/session";
import type { Actor } from "./review";

export const actorOf = (s: JiraSession): Actor => ({ accountId: s.accountId, name: s.name, email: s.email, role: s.role });
