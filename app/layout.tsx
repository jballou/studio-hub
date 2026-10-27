import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";

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
      <body className="paper flex min-h-full flex-row">
        <Suspense fallback={<div className="w-16 shrink-0 border-r border-line bg-white" />}>
          <Sidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
