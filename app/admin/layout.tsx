import { AdminTabs } from "@/components/admin/AdminTabs";

/** Preferences is a three-column page: the app sidebar, this sub-menu, then the page itself. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex w-full flex-1 flex-col md:flex-row">
      <aside className="shrink-0 border-b border-line bg-white/70 p-4 md:w-64 md:border-b-0 md:border-r md:p-6">
        <div className="md:sticky md:top-6">
          <p className="mb-2 px-4 text-muted eyebrow">Preferences</p>
          <AdminTabs />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
