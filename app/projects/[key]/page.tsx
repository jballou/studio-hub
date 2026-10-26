import { Suspense } from "react";
import { ProjectHome } from "@/components/projects/ProjectHome";

async function Home({ params }: { params: PageProps<"/projects/[key]">["params"] }) {
  const { key } = await params;
  return <ProjectHome jiraKey={decodeURIComponent(key)} />;
}

export default function ProjectPage({ params }: PageProps<"/projects/[key]">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <Home params={params} />
    </Suspense>
  );
}
