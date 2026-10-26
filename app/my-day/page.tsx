import { Suspense } from "react";
import { MyDay } from "@/components/myday/MyDay";

export default function MyDayPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <MyDay />
    </Suspense>
  );
}
