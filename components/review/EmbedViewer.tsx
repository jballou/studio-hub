"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Stage, type Zoom } from "./Stage";

/**
 * Link-based assets (Figma, Slides, Drive, staging pages) shown in an iframe with the
 * annotation layer on top. While commenting is on the layer captures clicks; turn it
 * off (the Comment toggle) to scroll or click inside the embedded page.
 */
/**
 * The embedded page is laid out at its natural size and then scaled to fill the box, so zooming grows the design itself
 * (the way a Figma frame, a slide or a page should), not just the window around it.
 */
function ScaledFrame({ src, width, aspect }: { src: string; width: number; aspect: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-white">
      <iframe
        src={src}
        title="Design preview"
        className="absolute left-0 top-0 border-0 bg-white"
        style={{ width, height: width / aspect, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        sandbox="allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  );
}

export function EmbedViewer({
  embedUrl, openUrl, aspect, baseWidth, zoom, commenting, overlay,
}: {
  embedUrl: string;
  openUrl: string;
  aspect: number;
  baseWidth: number;
  zoom: Zoom;
  commenting: boolean;
  overlay: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Stage aspect={aspect} zoom={zoom} baseWidth={baseWidth}>
        <ScaledFrame src={embedUrl} width={baseWidth} aspect={aspect} />
        {overlay}
      </Stage>
      <div className="flex items-center justify-center gap-4 pb-2 text-xs text-muted">
        <span>{commenting ? "Commenting is on. Turn it off to scroll or click inside the design." : "Commenting is off. Turn it on to add a pin."}</span>
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-medium text-brand hover:underline">
          Blank or blocked? Open in new tab <Icon name="chevronRight" size={12} />
        </a>
      </div>
    </div>
  );
}
