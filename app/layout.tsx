import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/Shell";
import { SegIndicator } from "@/components/SegIndicator";
import { Tour } from "@/components/Tour";

export const metadata: Metadata = {
  title: "Brand Creative Hub",
  description: "Briefs, assets and review, anchored to Jira",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Sets the saved (or system) theme before first paint so dark mode doesn't flash light. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('hub-theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}` }} />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="https://prod.smassets.net/assets/static/fonts/national2/regular.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="https://prod.smassets.net/assets/static/fonts/national2/bold.woff2" />
      </head>
      <body className="flex min-h-full flex-row">
        <Suspense fallback={<div className="w-16 shrink-0" />}>
          <Sidebar />
        </Suspense>
        <div className="shell my-2 mr-2 flex min-h-[calc(100vh-16px)] min-w-0 flex-1 flex-col overflow-clip rounded-loose border border-line bg-paper shadow-sm first:ml-2">
          <Suspense fallback={null}><TopBar /></Suspense>
          <SegIndicator />
          <div className="paper flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
        <Tour />
      </body>
    </html>
  );
}
