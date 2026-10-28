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
  const [rate, setRate] = useState(1);

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
    if (hasRvfc && !audio) id = v.requestVideoFrameCallback(tick);
    // Audio never produces video frames, so the frame callback stays silent; timeupdate (and the loop below) drive it.
    const onTU = () => { if (!hasRvfc || audio) report(v.currentTime); };
    const onSeeked = () => { lastMedia.current = null; report(v.currentTime); };
    v.addEventListener("timeupdate", onTU);
    v.addEventListener("seeked", onSeeked);
    return () => {
      v.removeEventListener("timeupdate", onTU);
      v.removeEventListener("seeked", onSeeked);
      if (hasRvfc && !audio) v.cancelVideoFrameCallback(id);
    };
  }, [report, src, audio]);

  // Smooth playhead for audio while it plays.
  useEffect(() => {
    const v = videoRef.current;
    if (!audio || !playing || !v) return;
    let id = 0;
    const loop = () => { report(v.currentTime); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [audio, playing, report]);

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

  const seekTo = (sec: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.min(duration, Math.max(0, sec));
    report(v.currentTime);
  };
  const skip = (by: number) => { const v = videoRef.current; if (v) seekTo(v.currentTime + by); };

  const scrub = (clientX: number) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !duration) return;
    const r = bar.getBoundingClientRect();
    seekTo(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration);
  };

  const total = duration * 1000;
  const pct = total ? Math.min(100, (ms / total) * 100) : 0;

  const videoEl = (
    <video
      ref={videoRef}
      src={src}
      playsInline
      preload="metadata"
      className={audio ? "hidden" : "absolute inset-0 h-full w-full bg-black"}
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
  );

  const bar = (
  <div className="flex flex-wrap items-start gap-x-2 gap-y-2 text-ink">
    <span className="flex h-8 items-center gap-0">
      <button onClick={() => skip(-10)} aria-label="Back 10 seconds" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-n-150"><Skip dir={-1} /></button>
      <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-n-150">
        <span className={playing ? "" : "translate-x-px"}><Icon name={playing ? "pause" : "play"} size={20} fill /></span>
      </button>
      <button onClick={() => skip(10)} aria-label="Forward 10 seconds" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-n-150"><Skip dir={1} /></button>
      {!audio && (
        <>
          <button onClick={() => step(-1)} className="h-8 rounded-md px-2 text-xs font-medium text-muted hover:bg-n-150 hover:text-ink" aria-label="Back one frame">‹1f</button>
          <button onClick={() => step(1)} className="h-8 rounded-md px-2 text-xs font-medium text-muted hover:bg-n-150 hover:text-ink" aria-label="Forward one frame">1f›</button>
        </>
      )}
    </span>

    <div className="relative mx-2 h-[3.25rem] min-w-[10rem] flex-1">
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(ms / 1000)}
        aria-valuetext={`${formatTime(ms)} of ${formatTime(total)}`}
        className="group absolute inset-x-0 top-0 h-8 cursor-pointer touch-none rounded outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); scrub(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons) scrub(e.clientX); }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          const by = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0;
          if (by) { e.preventDefault(); skip(by); }
          else if (e.key === "Home") { e.preventDefault(); seekTo(0); }
          else if (e.key === "End") { e.preventDefault(); seekTo(duration); }
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-n-200">
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <div
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-white shadow transition-transform ${dragging ? "scale-125" : "group-hover:scale-110"}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      {total > 0 && markers.map((m) => {
        const on = m.id === selectedId;
        return (
          <button
            key={m.id}
            onClick={() => onMarkerClick(m.id)}
            title={`${m.name} · #${m.number} at ${formatTime(m.timeMs)}`}
            aria-label={`Comment ${m.number} by ${m.name} at ${formatTime(m.timeMs)}`}
            aria-pressed={on}
            className={`group absolute top-[28px] z-10 -translate-x-1/2 focus-visible:outline-none hover:z-20 focus-visible:z-20 ${on ? "z-20" : ""}`}
            style={{ left: `${Math.min(100, (m.timeMs / total) * 100)}%` }}
          >
            <MapPin initials={m.initials} creative={m.creative} resolved={m.resolved} selected={on} />
          </button>
        );
      })}
    </div>

    <span className="flex h-8 items-center gap-2">
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted">{formatTime(ms)} / {formatTime(total)}</span>
      <button
        onClick={() => { const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; setRate(next); if (videoRef.current) videoRef.current.playbackRate = next; }}
        aria-label={`Playback speed ${rate}x. Click to change.`}
        className="h-7 min-w-9 rounded-md px-2 text-xs font-semibold hover:bg-n-150"
      >{rate}x</button>
    </span>
  </div>

  );

  if (audio && !usingFallback) {
    // One card: artwork on top, controls attached below.
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          <div className="flex h-52 flex-col items-center justify-center gap-2 bg-n-150 text-ink">
            {failed ? (
              <span className="px-6 text-center text-sm">Audio could not be loaded. Check the file still exists and your browser can play its format.</span>
            ) : (
              <>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" /></svg>
                <span className="text-sm">Audio. Comment at any point on the timeline.</span>
              </>
            )}
          </div>
          {videoEl}
          <div className="px-4 pb-4 pt-2">{bar}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Stage aspect={natural ?? aspect} zoom={zoom} baseWidth={baseW} reserve={usingFallback ? 0 : 104}>
        {videoEl}
        {usingFallback && <iframe src={fallbackEmbed} title="Drive player" allow="autoplay" className="absolute inset-0 h-full w-full border-0 bg-white" />}
        {failed && !fallbackEmbed && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 p-6 text-center text-sm text-white">
            {audio ? "Audio could not be loaded. Check the file still exists and your browser can play its format." : "Video could not be loaded. Use “Load local video” to review an MP4 from your machine."}
          </div>
        )}
        {overlay}
      </Stage>

      {usingFallback ? (
        <p className="border-t border-line bg-white px-4 py-4 text-sm">Drive wouldn&apos;t stream this file, so its own player is shown. Type the time you&apos;re at when you comment.</p>
      ) : (
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-line bg-white px-4 pb-4 pt-2 shadow-lg">
          {bar}
        </div>
      </div>
      )}
    </div>
  );
}

const RATES = [1, 1.25, 1.5, 2, 0.75];

/** Skip icon: a circular arrow with "10" inside. */
function Skip({ dir }: { dir: 1 | -1 }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir < 0 ? <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></> : <><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>}
      <text x="12" y="15.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">10</text>
    </svg>
  );
}

/** A small drop on the track that opens into the commenter's avatar on hover, focus or when selected. */
function MapPin({ initials, creative, resolved, selected }: { initials: string; creative: boolean; resolved: boolean; selected: boolean }) {
  const fill = resolved ? "#8a8780" : creative ? "#08794a" : "#464543";
  return (
    <span className="relative block h-4 w-3">
      <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true" className={`absolute left-0 top-0 transition-opacity duration-150 ${selected ? "opacity-0" : "group-hover:opacity-0 group-focus-visible:opacity-0"}`}>
        <path d="M6 0C6 0 0 5.6 0 10a6 6 0 0 0 12 0C12 5.6 6 0 6 0Z" fill={fill} />
      </svg>
      <span
        className={`absolute left-1/2 top-0 flex origin-top -translate-x-1/2 scale-50 flex-col items-center opacity-0 transition duration-150 ${selected ? "scale-100 opacity-100" : "group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"}`}
        aria-hidden="true"
      >
        <span className="h-0 w-0 border-x-[5px] border-b-[6px] border-x-transparent" style={{ borderBottomColor: fill }} />
        <span
          className="-mt-px flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-n-50 shadow-md ring-2 ring-white"
          style={{ background: fill, outline: selected ? "2px solid var(--color-ink)" : "none", outlineOffset: 1 }}
        >
          {initials.slice(0, 2)}
        </span>
      </span>
    </span>
  );
}
