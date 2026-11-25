import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminSystem } from "@/components/admin/AdminSystem";
import { PageTitle } from "@/components/PageTitle";

export default function SystemSettingsPage() {
  return (
    <main className="page [&>*:not(.fixed)]:max-w-3xl">
      <PageTitle>System settings</PageTitle>
      <AdminSettings />
      <div className="mt-12"><AdminSystem /></div>
    </main>
  );
}
