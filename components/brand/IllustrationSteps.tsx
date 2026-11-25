import { ILLUSTRATION_LINKS as L } from "@/lib/brief/illustration";

const link = "font-medium text-brand underline-offset-2 hover:underline";

/** The Brand Creative team's illustration intake process, in order. Used in the request dialog and above the request form. */
export function IllustrationSteps({ library = true }: { library?: boolean }) {
  const steps: { title: string; body: React.ReactNode }[] = [
    { title: "Look through the library", body: <>{library ? "Search and browse this page" : "Search and browse the Illustrations page"} first. Approved, ready-to-download illustrations are the fastest route. For slides, the <a className={link} href={L.slides} target="_blank" rel="noreferrer">Grab ’n Go deck</a> has them ready to paste.</> },
    { title: "Check the usage guidelines", body: <>Read the <a className={link} href={L.guidelines} target="_blank" rel="noreferrer">illustration usage guidelines</a> so you use the right one the right way.</> },
    { title: "Request what's missing", body: <>If nothing fits, request a new illustration or a change to an existing one. It becomes a ticket under the illustration requests Epic, and the team gets back to you as soon as possible.</> },
    { title: "Ask if you're unsure", body: <>Questions, recommendations or a QA of something you saw? Post in <a className={link} href={L.slack} target="_blank" rel="noreferrer">#ask-illustration</a> or join Illustration Office Hours. Product and Brand Creative team members who edit a library illustration share it there for approval.</> },
  ];
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-round bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
          <div className="min-w-0">
            <p className="font-bold">{s.title}</p>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
