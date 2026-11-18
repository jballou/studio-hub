import { PageTitle } from "@/components/PageTitle";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <PageTitle>Brand</PageTitle>
      {children}
    </main>
  );
}
