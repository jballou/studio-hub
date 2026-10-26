import { Suspense } from "react";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";

async function Workspace({ params }: { params: PageProps<"/review/[assetId]">["params"] }) {
  const { assetId } = await params;
  return <ReviewWorkspace assetId={assetId} />;
}

export default function ReviewPage({ params }: PageProps<"/review/[assetId]">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <Workspace params={params} />
    </Suspense>
  );
}
