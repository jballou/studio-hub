"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { Stage } from "./Stage";

export type VideoHandle = {
  pause: () => void;
  seek: (ms: number) => void;
  currentMs: () => number;
};

export type Marker = { id: string; timeMs: number; initials: string; number: number; resolved: boolean };

export function formatTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function VideoViewer({
  src, aspect, overlay, markers, selectedId, onMarkerClick, onTime, handleRef,
}: {
  src: string;
  aspect: number;
  overlay: ReactNode;
  markers: Marker[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
  onTime: (ms: number) => void;
  handleRef: Ref<VideoHandle>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fps = useRef(30);
  const minDelta = useRef(Infinity);
  const lastMedia = useRef<number | null>(null);
  const [ms, setMs] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [natural, setNatural] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const report = useCallback((t: number) => {
    const next = Math.round(t * 1000);
    setMs(next);
    onTime(next);
  }, [onTime]);

  useImperativeHandle(handleRef, () => ({
    pause: () => videoRef.current?.pause(),
    seek: (m) => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      v.currentTime = m / 1000;
      report(v.currentTime);
    },
    currentMs: () => Math.round((videoRef.current?.currentTime ?? 0) * 1000),
  }), [report]);

  // Frame-accurate time updates; also estimates fps from the smallest frame gap seen.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let id = 0;
    const hasRvfc = typeof v.requestVideoFrameCallback === "function";
    const tick = (_now: number, meta: { mediaTime: number }) => {
      if (lastMedia.current !== null) {
        const d = meta.mediaTime - lastMedia.current;
        if (d > 0.004 && d < 0.2 && d < minDelta.current) {
          minDelta.current = d;
          fps.current = Math.min(120, Math.round(1 / d));
        }
      }
      lastMedia.current = meta.mediaTime;
      report(meta.mediaTime);
      id = v.requestVideoFrameCallback(tick);
    };
    if (hasRvfc) id = v.requestVideoFrameCallback(tick);
    const onTU = () => { if (!hasRvfc) report(v.currentTime); };
    const onSeeked = () => { lastMedia.current = null; report(v.currentTime); };
    v.addEventListener("timeupdate", onTU);
    v.addEventListener("seeked", onSeeked);
    return () => {
      v.removeEventListener("timeupdate", onTU);
      v.removeEventListener("seeked", onSeeked);
      if (hasRvfc) v.cancelVideoFrameCallback(id);
    };
  }, [report, src]);

  const step = (dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const n = Math.floor(v.currentTime * fps.current + 1e-3);
    v.currentTime = Math.min(v.duration || Infinity, Math.max(0, (n + dir + 0.5) / fps.current));
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  };

  const scrub = (clientX: number) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !duration) return;
    const r = bar.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
  };

  const total = duration * 1000;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Stage aspect={natural ?? aspect}>
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full bg-black"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (Number.isFinite(v.duration)) {
              setDuration(v.duration);
            } else {
              // MediaRecorder-style WebM reports Infinity until the end is reached once.
              v.addEventListener("durationchange", () => {
                if (Number.isFinite(v.duration)) { setDuration(v.duration); v.currentTime = 0; }
              }, { once: true });
              v.currentTime = 1e101;
            }
            if (v.videoWidth) setNatural(v.videoWidth / v.videoHeight);
            setFailed(false);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 p-6 text-center text-sm text-white">
            Video could not be loaded. Use “Load local video” to review an MP4 from your machine.
          </div>
        )}
        {overlay}
      </Stage>

      <div className="flex items-center gap-3 border-t border-line bg-white px-4 py-3">
        <button onClick={toggle} className="w-12 rounded border border-line px-2 py-1 text-sm hover:bg-brand-soft" aria-label={playing ? "Pause" : "Play"}>
          {playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => step(-1)} className="rounded border border-line px-2 py-1 text-sm hover:bg-brand-soft" aria-label="Back one frame">‹ 1f</button>
        <button onClick={() => step(1)} className="rounded border border-line px-2 py-1 text-sm hover:bg-brand-soft" aria-label="Forward one frame">1f ›</button>
        <span className="w-24 font-mono text-xs text-muted">{formatTime(ms)} / {formatTime(total)}</span>

        <div
          ref={barRef}
          className="relative mt-5 h-2 flex-1 cursor-pointer rounded-full bg-line"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e.clientX); }}
          onPointerMove={(e) => { if (e.buttons) scrub(e.clientX); }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: total ? `${(ms / total) * 100}%` : 0 }} />
          {total > 0 && markers.map((m) => (
            <button
              key={m.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onMarkerClick(m.id)}
              title={`#${m.number} at ${formatTime(m.timeMs)}`}
              className="absolute -top-6 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{
                left: `${Math.min(100, (m.timeMs / total) * 100)}%`,
                background: m.resolved ? "#78716c" : "#089b5e",
                outline: m.id === selectedId ? "2px solid #1c1917" : "none",
              }}
            >
              {m.initials}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
