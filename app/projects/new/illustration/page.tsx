import Link from "next/link";
import { BriefWizard } from "@/components/brief/BriefWizard";
import { IllustrationSteps } from "@/components/brand/IllustrationSteps";
import { ILLUSTRATION_EPIC, ILLUSTRATION_FLOW, ILLUSTRATION_LINKS } from "@/lib/brief/illustration";

export default function NewIllustrationRequestPage() {
  return (
    <BriefWizard
      flow={ILLUSTRATION_FLOW}
      parentKey={ILLUSTRATION_EPIC}
      heading="Request an illustration"
      draftKey="illustration-request-draft-v1"
      before={
        <details className="rounded-loose border border-line bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold">How illustration requests work</summary>
          <div className="mt-4"><IllustrationSteps library={false} /></div>
          <p className="mt-4 text-sm text-muted"><Link href="/brand/illustrations" className="font-medium text-brand hover:underline">Browse the illustration library</Link> before you send this.</p>
        </details>
      }
      doneNote={<>Your request is linked to the illustration requests Epic. Questions while you wait? Ask in <a className="font-medium text-brand hover:underline" href={ILLUSTRATION_LINKS.slack} target="_blank" rel="noreferrer">#ask-illustration</a>.</>}
    />
  );
}
