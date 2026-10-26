import { Suspense } from "react";
import { SubmitForm } from "@/components/submit/SubmitForm";

export default function SubmitPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <SubmitForm />
    </Suspense>
  );
}
