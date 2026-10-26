"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Stage, type Zoom } from "./Stage";

const RENDER_SCALE = 2;

export function PdfViewer({
  src, page, zoom, onPageCount, overlay,
}: {
  src: string;
  zoom: Zoom;
  page: number;
  onPageCount: (n: number) => void;
  overlay: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = useRef<any>(null);
  const [ready, setReady] = useState(0); // bumps when a new doc is loaded
  const [aspect, setAspect] = useState(8.5 / 11);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjs.getDocument({ url: src }).promise;
        if (cancelled) return;
        docRef.current = doc;
        onPageCount(doc.numPages);
        setError(null);
        setReady((n) => n + 1);
      } catch {
        if (!cancelled) setError("Could not load this PDF.");
      }
    })();
    return () => { cancelled = true; };
  }, [src, onPageCount]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let cancelled = false;
    (async () => {
      const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
      if (cancelled) return;
      const viewport = p.getViewport({ scale: RENDER_SCALE });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setAspect(viewport.width / viewport.height);
      task = p.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport });
      try { await task!.promise; } catch { /* cancelled render */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [page, ready]);

  return (
    <Stage aspect={aspect} zoom={zoom} baseWidth={816}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {error && <div className="absolute inset-0 flex items-center justify-center text-sm text-bad-fg">{error}</div>}
      {overlay}
    </Stage>
  );
}
