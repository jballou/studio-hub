"use client";

import { useState } from "react";
import { LogoLoader } from "@/components/ui/LogoLoader";

/** An image that shows the logo loader until it has loaded, then fades in. The parent needs `relative`. */
export function LoadingImg({ src, className = "", eager }: { src: string; className?: string; eager?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <>
      {!done && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-brand"><LogoLoader size={48} label="Loading image" /></span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setDone(true); }}
        src={src} alt="" decoding="async" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"}
        onLoad={() => setDone(true)} onError={() => setDone(true)}
        className={`${className} transition-opacity duration-300 ${done ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
