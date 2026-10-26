"use client";

import { useState, type ReactNode } from "react";
import { Stage, type Zoom } from "./Stage";

export function ImageViewer({ src, aspect, zoom, overlay }: { src: string; aspect: number; zoom: Zoom; overlay: ReactNode }) {
  const [natural, setNatural] = useState<number | null>(null);
  const [width, setWidth] = useState(1000);
  return (
    <Stage aspect={natural ?? aspect} zoom={zoom} baseWidth={width}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        onLoad={(e) => { setNatural(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || null); setWidth(e.currentTarget.naturalWidth || 1000); }}
      />
      {overlay}
    </Stage>
  );
}
