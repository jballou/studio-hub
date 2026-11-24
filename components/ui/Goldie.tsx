"use client";

import { useState } from "react";

const MARK = "url(/library/logos/surveymonkey/logomark-black.svg) center / contain no-repeat";

/** Goldie, the SurveyMonkey mark, hopping in brand green. Stands still (and gently fades) for people who prefer less motion. */
export function Goldie({ size = 32, label }: { size?: number; label?: string }) {
  return (
    <span role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="goldie inline-block bg-brand" style={{ width: size, height: size, WebkitMask: MARK, mask: MARK }} />
  );
}

/** An image that shows Goldie until it has loaded, then fades in. The parent needs `relative`. */
export function LoadingImg({ src, className = "", eager }: { src: string; className?: string; eager?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <>
      {!done && <span className="pointer-events-none absolute inset-0 flex items-center justify-center"><Goldie size={32} /></span>}
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
