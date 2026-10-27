import { confetti } from "./confetti";
import { playSfx } from "./sfx";

/** Confetti and the celebration sound. For finishing a ticket or task and for approving a design. */
export function celebrate(): void {
  confetti();
  playSfx("celebrate");
}

/** Jira statuses that mean the work was actually delivered. Cancelled, Won't Do and Duplicate don't get a party. */
export const isDeliveredStatus = (name: string): boolean => ["done", "delivered", "complete", "completed", "resolved"].includes(name.trim().toLowerCase());
