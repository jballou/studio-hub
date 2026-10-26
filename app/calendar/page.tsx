import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <CalendarView />
    </Suspense>
  );
}
