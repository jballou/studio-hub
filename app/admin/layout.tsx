import { AdminTabs } from "@/components/admin/AdminTabs";

/** Preferences sections sit in a browser-style tab strip above the page. The active tab joins the page below it. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <AdminTabs />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
