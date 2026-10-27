import { Suspense } from "react";
import { MyBriefs } from "@/components/briefs/MyBriefs";

export default function BriefsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <MyBriefs />
    </Suspense>
  );
}
