"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatTime } from "@/lib/timecode";
import { Stage, type Zoom } from "./Stage";

export type VideoHandle = {
  pause: () => void;
  seek: (ms: number) => void;
  currentMs: () => number;
};

export type Marker = { id: string; timeMs: number; initials: string; name: string; creative: boolean; number: number; resolved: boolean };

export { formatTime };

export function VideoViewer({
  src, aspect, overlay, markers, selectedId, onMarkerClick, onTime, handleRef, zoom = "fit", audio = false, fallbackEmbed, onFallback,
}: {
  src: string;
  aspect: number;
  overlay: ReactNode;
  markers: Marker[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
  onTime: (ms: number) => void;
  handleRef: Ref<VideoHandle>;
  /** Audio files play in the same element; no frames or pins, timecoded comments only. */
  audio?: boolean;
  zoom?: Zoom;
  /** A preview page to show if the file itself won't play (Drive files that can't be streamed). It can't report time, so the parent asks for typed timestamps. */
  fallbackEmbed?: string;
  onFallback?: (active: boolean) => void;
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
  const [baseW, setBaseW] = useState(1280);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const usingFallback = failed && !!fallbackEmbed;
  useEffect(() => { onFallback?.(usingFallback); }, [usingFallback, onFallback]);

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
  const pct = total ? Math.min(100, (ms / total) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Stage aspect={natural ?? aspect} zoom={zoom} baseWidth={baseW}>
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
            if (v.videoWidth) { setNatural(v.videoWidth / v.videoHeight); setBaseW(v.videoWidth); }
            setFailed(false);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        />
        {audio && !failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink text-n-50">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
            </svg>
            <span className="text-sm">Audio. Comment at any point on the timeline.</span>
          </div>
        )}
        {usingFallback && <iframe src={fallbackEmbed} title="Drive player" allow="autoplay" className="absolute inset-0 h-full w-full border-0 bg-white" />}
        {failed && !fallbackEmbed && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 p-6 text-center text-sm text-white">
            {audio ? "Audio could not be loaded. Check the file still exists and your browser can play its format." : "Video could not be loaded. Use “Load local video” to review an MP4 from your machine."}
          </div>
        )}
        {overlay}
      </Stage>

      {usingFallback ? (
        <p className="bg-ink px-4 py-3 text-sm text-n-50">Drive wouldn&apos;t stream this file, so its own player is shown. Type the time you&apos;re at when you comment.</p>
      ) : (
      <div className="flex items-center gap-4 bg-ink px-5 pb-3 pt-9 text-n-50">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-n-50 text-ink shadow-sm transition hover:scale-105 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-n-50"
        >
          <span className={playing ? "" : "translate-x-px"}><Icon name={playing ? "pause" : "play"} size={18} fill /></span>
        </button>
        {!audio && (
          <span className="flex shrink-0 items-center gap-1">
            <button onClick={() => step(-1)} className="h-8 rounded-md px-2 text-xs font-medium text-n-50/80 hover:bg-white/10 hover:text-n-50" aria-label="Back one frame">‹ 1f</button>
            <button onClick={() => step(1)} className="h-8 rounded-md px-2 text-xs font-medium text-n-50/80 hover:bg-white/10 hover:text-n-50" aria-label="Forward one frame">1f ›</button>
          </span>
        )}
        <span className="w-28 shrink-0 text-center font-mono text-xs tabular-nums text-n-50/90">
          {formatTime(ms)} <span className="text-n-50/50">/</span> {formatTime(total)}
        </span>

        <div className="relative h-10 min-w-0 flex-1">
          <div
            ref={barRef}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(ms / 1000)}
            aria-valuetext={`${formatTime(ms)} of ${formatTime(total)}`}
            className="group absolute inset-0 cursor-pointer touch-none rounded outline-none focus-visible:ring-2 focus-visible:ring-n-50/60"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); scrub(e.clientX); }}
            onPointerMove={(e) => { if (e.buttons) scrub(e.clientX); }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onKeyDown={(e) => {
              const v = videoRef.current;
              if (!v || !duration) return;
              const by = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0;
              if (by) { e.preventDefault(); v.currentTime = Math.min(duration, Math.max(0, v.currentTime + by)); }
              else if (e.key === "Home") { e.preventDefault(); v.currentTime = 0; }
              else if (e.key === "End") { e.preventDefault(); v.currentTime = duration; }
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20 transition-[height] group-hover:h-2">
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand-fill" style={{ width: `${pct}%` }} />
            </div>
            <div
              className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-n-50 shadow-md ring-4 ring-brand-fill/30 transition-transform ${dragging ? "scale-125" : "group-hover:scale-110"}`}
              style={{ left: `${pct}%` }}
            />
          </div>
          {total > 0 && markers.map((m) => {
            const left = Math.min(100, (m.timeMs / total) * 100);
            const on = m.id === selectedId;
            return (
              <button
                key={m.id}
                onClick={() => onMarkerClick(m.id)}
                title={`${m.name} · #${m.number} at ${formatTime(m.timeMs)}`}
                aria-label={`Comment ${m.number} by ${m.name} at ${formatTime(m.timeMs)}`}
                aria-pressed={on}
                className={`absolute bottom-1/2 z-10 -translate-x-1/2 transition-transform hover:z-20 hover:-translate-y-0.5 focus-visible:outline-none ${on ? "z-20 -translate-y-1 scale-110" : ""}`}
                style={{ left: `${left}%`, marginBottom: 8 }}
              >
                <MapPin initials={m.initials} creative={m.creative} resolved={m.resolved} selected={on} />
              </button>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

/** A map marker: a teardrop pin with the commenter's avatar on it. */
function MapPin({ initials, creative, resolved, selected }: { initials: string; creative: boolean; resolved: boolean; selected: boolean }) {
  const fill = resolved ? "#8a8780" : creative ? "#0b7a4a" : "#3d3b37";
  return (
    <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true" className="block drop-shadow-md">
      <path
        d="M15 37C15 37 2 23.5 2 14.5C2 7.04 7.82 1.5 15 1.5C22.18 1.5 28 7.04 28 14.5C28 23.5 15 37 15 37Z"
        fill={fill} stroke={selected ? "#fefdfb" : "rgba(254,253,251,0.85)"} strokeWidth={selected ? 2.5 : 1.5}
      />
      <circle cx="15" cy="14.5" r="9" fill="#fefdfb" fillOpacity={resolved ? 0.75 : 1} />
      <text x="15" y="14.5" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fontWeight="700" fill={fill} fontFamily="inherit">{initials.slice(0, 2)}</text>
    </svg>
  );
}
