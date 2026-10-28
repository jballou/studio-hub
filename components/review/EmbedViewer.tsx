"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Stage, type Zoom } from "./Stage";

/**
 * Link-based assets (Figma, Slides, Drive, staging pages) shown in an iframe with the
 * annotation layer on top. While commenting is on the layer captures clicks; turn it
 * off (the Comment toggle) to scroll or click inside the embedded page.
 */
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
        <iframe
          src={embedUrl}
          title="Design preview"
          className="absolute inset-0 h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
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
