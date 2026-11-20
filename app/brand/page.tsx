import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { Icon, type IconName } from "@/components/ui/Icon";

const AREAS: { href: string; title: string; text: string; icon: IconName }[] = [
  { href: "/brand/logos", title: "Logos", text: "SurveyMonkey, LaunchPad and GetFeedback logos in every approved color, as SVG or PNG.", icon: "star" },
  { href: "/brand/colors", title: "Color", text: "The full palette with HEX, RGB, CMYK and Pantone values. Click a swatch to copy it.", icon: "palette" },
  { href: "/brand/type", title: "Typography", text: "National 2 and the type scale for display, headline, title, label and body text.", icon: "edit" },
  { href: "/brand/photos", title: "Photos", text: "Retouched, cut-out and full-bleed photography, sorted by theme. Download as JPG, PNG or WebP.", icon: "image" },
  { href: "/brand/illustrations", title: "Illustrations", text: "Hero, spot and product illustrations for every layout size.", icon: "pencilRuler" },
  { href: "/brand/icons", title: "Icons", text: "Search and download every functional icon as SVG, in any size and color.", icon: "search" },
];

export default function BrandHome() {
  return (
    <>
      <PageTitle>Brand Assets</PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-muted">Approved brand assets, ready to use. Everything here comes from the Project Catalyst Figma file, so what you download is what the brand team signed off.</p>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
        {AREAS.map((a) => (
          <Link key={a.href} href={a.href} className="card card-hover block p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-round bg-brand-soft text-ink"><Icon name={a.icon} size={20} /></span>
            <h2 className="mt-4 text-lg font-bold">{a.title}</h2>
            <p className="mt-2 text-sm text-muted">{a.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
