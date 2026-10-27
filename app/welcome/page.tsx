import { Suspense } from "react";
import { Welcome } from "@/components/auth/Welcome";

export default function WelcomePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <Welcome />
    </Suspense>
  );
}
