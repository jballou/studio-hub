import Link from "next/link";

export default function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  return (
    <>
      <nav className="flex items-center gap-6 border-b border-line bg-white px-6 py-3 text-sm">
        <span className="font-bold text-brand">Brand Creative Hub</span>
        <Link href="/projects" className="hover:underline">Projects</Link>
        <Link href="/review" className="hover:underline">Review</Link>
        <Link href="/projects/new" className="ml-auto rounded bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark">New brief</Link>
      </nav>
      {children}
    </>
  );
}
