import { AdminTabs } from "@/components/admin/AdminTabs";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="w-full">
      <div className="border-b border-line bg-white/70 px-6 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Admin</p>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
