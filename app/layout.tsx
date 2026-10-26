import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brand Creative Hub",
  description: "Briefs, assets and review, anchored to Jira",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${workSans.variable} h-full antialiased`}>
      <body className="paper flex min-h-full flex-row">
        <Suspense fallback={<div className="w-16 shrink-0 border-r border-line bg-white" />}>
          <Sidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
