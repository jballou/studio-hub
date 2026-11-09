import { Suspense } from "react";
import { MyDayHome } from "@/components/myday/MyDayHome";

export default function MyDayPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <MyDayHome />
    </Suspense>
  );
}
