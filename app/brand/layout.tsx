import { BrandTabs } from "@/components/brand/BrandTabs";
import { PageTitle } from "@/components/PageTitle";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <PageTitle>Brand</PageTitle>
      <BrandTabs />
      {children}
    </main>
  );
}
