"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ABSTRACT, ILLUSTRATIONS, imageScene, PALETTE_SIZE, textScene, type RGB, type Scene } from "./flipScenes";

const ROWS = 9;          // tiles tall
const TARGET = 18;       // about this many pixels per tile
const GAP = 2;           // space between tiles
const FLIP_MS = 140;     // one flap falling
const SPREAD_MS = 1100;  // how long a wave of flips takes to cross the board

const parse = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Where in the wave each tile flips, 0 to 1. Rotates so each change of picture arrives a different way. */
const PATTERNS: ((x: number, y: number, cols: number, rows: number, r: number) => number)[] = [
  (x, _y, cols) => x / cols,
  (x, y, cols, rows) => (x / cols + y / rows) / 2,
  (x, y, cols, rows) => Math.hypot((x - cols / 2) / cols, (y - rows / 2) / rows) * 1.6,
  (_x, y, _c, rows, r) => y / rows * 0.8 + r * 0.2,
  (_x, _y, _c, _r, r) => r,
];

type Props = {
  /** A line of text the board can spell out, like "Good morning, Avery". */
  greeting?: string;
  /** Extra pictures or illustrations (PNG, SVG, JPG) to pixelate and add to the rotation. */
  images?: string[];
  /** Milliseconds each picture stays up. */
  interval?: number;
};

/**
 * A split-flap display, like a Vestaboard. A grid of tiles flips from one picture to the next: generated abstract
 * patterns, drawn illustrations, and any image you hand it, all reduced to the brand palette. Decorative.
 */
export function FlipBoard({ greeting, images = ["/brand/monkey-512.png"], interval = 9000 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const greetingRef = useRef(greeting);
  const api = useRef<{ next: () => void; setPaused: (p: boolean) => void } | null>(null);
  const [paused, setPaused] = useState(false);
  const imageKey = images.join("|");

  useEffect(() => { greetingRef.current = greeting; }, [greeting]);

  useEffect(() => {
    const el = wrap.current, cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const hex = Array.from({ length: PALETTE_SIZE }, (_, i) => css.getPropertyValue(`--flap-${i}`).trim() || "#000000");
    const pal = hex.map(parse);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Abstract and drawn scenes alternate; pictures and the greeting are folded in between.
    const pics = imageKey.split("|").filter(Boolean).map((src, i) => imageScene(src, `Picture ${i + 1}`));
    const greet: Scene = { name: "Greeting", build: (c) => textScene(greetingRef.current || "Hello").build(c) };
    const scenes: Scene[] = [ABSTRACT[0], ILLUSTRATIONS[0], ...pics, ABSTRACT[1], ILLUSTRATIONS[2], greet, ABSTRACT[2], ILLUSTRATIONS[1], ABSTRACT[3]];

    let cols = 0, pitch = 0, n = 0, width = 0;
    let cur = new Uint8Array(0), to = new Uint8Array(0);
    let seq: number[][] = [];
    let delay = new Float64Array(0), flipAt = new Float64Array(0);
    let sceneIdx = -1, skips = 0, token = 0, timer = 0, raf = 0, pattern = 0, paused = false, visible = true, disposed = false;

    const rr = (x: number, y: number, w: number, h: number) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 2); else ctx.rect(x, y, w, h);
    };

    /** One tile. u is how far its flap has fallen (0..1), or -1 when it is at rest. */
    const drawTile = (i: number, u: number) => {
      const s = pitch - GAP, px = (i % cols) * pitch + GAP / 2, py = Math.floor(i / cols) * pitch + GAP / 2, h = s / 2, seam = py + h;
      ctx.clearRect(px - 1, py - 1, s + 2, s + 2);
      if (u < 0) {
        ctx.fillStyle = hex[cur[i]]; rr(px, py, s, s); ctx.fill();
      } else {
        // Behind the flap: the new top half and the old bottom half.
        ctx.fillStyle = hex[to[i]]; ctx.fillRect(px, py, s, h);
        ctx.fillStyle = hex[cur[i]]; ctx.fillRect(px, seam, s, h);
        if (u < 0.5) {
          const k = 1 - u * 2;   // the old top half folds down toward the seam
          ctx.fillStyle = hex[cur[i]]; ctx.fillRect(px, seam - h * k, s, h * k);
          ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - k)})`; ctx.fillRect(px, seam - h * k, s, h * k);
        } else {
          const k = u * 2 - 1;   // the new bottom half falls into place
          ctx.fillStyle = hex[to[i]]; ctx.fillRect(px, seam, s, h * k);
          ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - k)})`; ctx.fillRect(px, seam, s, h * k);
        }
      }
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(px, seam - 0.5, s, 1);
    };
    const drawAll = () => { for (let i = 0; i < n; i++) drawTile(i, -1); };

    const schedule = () => {
      window.clearTimeout(timer);
      if (reduced) return;
      timer = window.setTimeout(advance, interval);
    };
    function advance() {
      if (disposed) return;
      if (paused || !visible || document.hidden) { timer = window.setTimeout(advance, 1000); return; }
      void go((sceneIdx + 1) % scenes.length, false);
    }

    const frame = (now: number) => {
      raf = 0;
      let active = false;
      for (let i = 0; i < n; i++) {
        if (flipAt[i] < 0) {
          if (!seq[i].length) continue;
          active = true;
          if (now < delay[i]) continue;
          to[i] = seq[i].shift() as number; flipAt[i] = now;
        }
        const u = (now - flipAt[i]) / FLIP_MS;
        if (u >= 1) {
          cur[i] = to[i];
          if (seq[i].length) { to[i] = seq[i].shift() as number; flipAt[i] = now; active = true; drawTile(i, 0); }
          else { flipAt[i] = -1; drawTile(i, -1); }
        } else { active = true; drawTile(i, u); }
      }
      if (active) raf = requestAnimationFrame(frame); else schedule();
    };

    async function go(idx: number, instant: boolean) {
      const mine = ++token;
      sceneIdx = idx;
      let grid: Uint8Array;
      try { grid = await scenes[idx].build({ cols, rows: ROWS, pal, hex, seed: Math.floor(Math.random() * 100000) }); }
      catch {
        // A picture that won't load, or text that won't fit, is skipped.
        if (mine === token && !disposed && skips++ < scenes.length) void go((idx + 1) % scenes.length, instant);
        return;
      }
      skips = 0;
      if (mine !== token || disposed) return;
      if (instant || reduced) {
        for (let i = 0; i < n; i++) { cur[i] = grid[i]; seq[i] = []; flipAt[i] = -1; }
        drawAll();
        schedule();
        return;
      }
      const now = performance.now(), fn = PATTERNS[pattern++ % PATTERNS.length];
      for (let i = 0; i < n; i++) {
        const last = flipAt[i] >= 0 ? to[i] : cur[i];
        if (grid[i] === last) { seq[i] = []; continue; }   // already showing this color; drop any flips left over from a picture we skipped past
        const mids = 1 + Math.floor(Math.random() * 3), q: number[] = [];
        for (let m = 0; m < mids; m++) { let c = Math.floor(Math.random() * PALETTE_SIZE); if (c === grid[i]) c = (c + 1) % PALETTE_SIZE; q.push(c); }
        q.push(grid[i]);
        seq[i] = q;
        delay[i] = now + fn(i % cols, Math.floor(i / cols), cols, ROWS, Math.random()) * SPREAD_MS + Math.random() * 100;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }

    const layout = () => {
      width = el.clientWidth;
      if (!width) return false;
      cols = Math.min(120, Math.max(12, Math.round(width / TARGET)));
      pitch = width / cols; n = cols * ROWS;
      const dpr = window.devicePixelRatio || 1, height = pitch * ROWS;
      cv.style.width = `${width}px`; cv.style.height = `${height}px`;
      cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cur = new Uint8Array(n); to = new Uint8Array(n);
      seq = Array.from({ length: n }, () => []);
      delay = new Float64Array(n); flipAt = new Float64Array(n).fill(-1);
      drawAll();
      return true;
    };

    if (layout()) void go(0, false);
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - width) < 2) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { if (layout()) void go(Math.max(sceneIdx, 0), true); }, 150);
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.1 });
    io.observe(el);

    api.current = {
      next: () => { window.clearTimeout(timer); void go((sceneIdx + 1) % scenes.length, false); },
      setPaused: (p) => { paused = p; if (!p) schedule(); else window.clearTimeout(timer); },
    };

    return () => {
      disposed = true; token++;
      window.clearTimeout(timer); window.clearTimeout(resizeTimer); cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); api.current = null;
    };
  }, [imageKey, interval]);

  const btn = "flex h-8 w-8 items-center justify-center rounded-round bg-n-1000/60 text-n-50 hover:bg-n-1000/80";
  return (
    <div
      className="group relative overflow-hidden rounded-loose p-4"
      style={{ background: "var(--board-bg)" }}
      role="img"
      aria-label="Animated display of abstract art and pixel illustrations"
    >
      {/* Outer corner 24px, padding 16px, so the tiles are clipped to an 8px corner that sits concentric with it. */}
      <div ref={wrap} className="w-full overflow-hidden rounded-tight"><canvas ref={canvas} aria-hidden="true" className="block" /></div>
      <div className="absolute bottom-6 right-6 flex gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <button type="button" onClick={() => { const p = !paused; setPaused(p); api.current?.setPaused(p); }} aria-pressed={paused} aria-label={paused ? "Resume the display" : "Pause the display"} className={btn}>
          <Icon name={paused ? "play" : "pause"} size={14} />
        </button>
        <button type="button" onClick={() => api.current?.next()} aria-label="Show the next picture" className={btn}>
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  );
}
