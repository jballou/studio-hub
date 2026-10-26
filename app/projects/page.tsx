import { Suspense } from "react";
import { ProjectsView } from "@/components/projects/ProjectsView";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <ProjectsView />
    </Suspense>
  );
}
