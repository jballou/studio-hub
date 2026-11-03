import { AdminTabs } from "@/components/admin/AdminTabs";

/** Preferences is a three-column page: the app sidebar, this sub-menu, then the page itself. The sub-menu sits inside the shared content column so the top bar lines up with it. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-1 flex-col md:flex-row">
      <aside className="shrink-0 border-b border-line p-4 md:w-64 md:border-b-0 md:border-r md:py-8 md:pl-8 md:pr-6">
        <div className="md:sticky md:top-8">
          <p className="mb-2 px-4 text-muted eyebrow">Preferences</p>
          <AdminTabs />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
