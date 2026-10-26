"use client";

import { useState, type ReactNode } from "react";
import { Stage } from "./Stage";

export function ImageViewer({ src, aspect, overlay }: { src: string; aspect: number; overlay: ReactNode }) {
  const [natural, setNatural] = useState<number | null>(null);
  return (
    <Stage aspect={natural ?? aspect}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        onLoad={(e) => setNatural(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || null)}
      />
      {overlay}
    </Stage>
  );
}
