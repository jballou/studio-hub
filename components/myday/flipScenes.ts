/** What the flip board can show. Every scene turns the board's grid (cols x rows) into a list of palette indices. */

export type RGB = [number, number, number];
export type SceneCtx = { cols: number; rows: number; pal: RGB[]; hex: string[]; seed: number };
export type Scene = { name: string; build: (c: SceneCtx) => Uint8Array | Promise<Uint8Array> };

// Palette slots (see --flap-N in globals.css).
const OFF = 0, G7 = 1, G5 = 2, G2 = 3, T3 = 4, T6 = 5, Y2 = 6, O5 = 7, P2 = 8, P6 = 9, PAPER = 10, T8 = 11, O7 = 12;
export const PALETTE_SIZE = 13;

// Dark to light, so a 0..1 value picks a color along the ramp.
const R_GREEN = [OFF, T8, G7, G5, G2, PAPER];
const R_COOL = [OFF, P6, P2, T3, PAPER];
const R_SUN = [OFF, O7, O5, Y2, PAPER];
const R_PLASMA = [OFF, P6, P2, T3, T6, G5, G2, Y2, O5];

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => v / 16));
const clamp01 = (v: number) => Math.min(0.9999, Math.max(0, v));

/** A seeded random generator, so a scene can be redrawn the same way on resize. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value from 0 to 1 becomes a color on the ramp, dithered with an ordered pattern so gradients read as pixels. */
function pick(ramp: number[], v: number, x: number, y: number) {
  const t = clamp01(v) * (ramp.length - 1);
  const i = Math.floor(t);
  return t - i > BAYER[y & 3][x & 3] ? ramp[i + 1] : ramp[i];
}

function field(c: SceneCtx, ramp: number[], f: (x: number, y: number) => number) {
  const out = new Uint8Array(c.cols * c.rows);
  for (let y = 0; y < c.rows; y++) for (let x = 0; x < c.cols; x++) out[y * c.cols + x] = pick(ramp, f(x, y), x, y);
  return out;
}

/** Nearest palette color, with an ordered dither so photos and gradients keep their shading. */
function quantize(data: Uint8ClampedArray, cols: number, rows: number, pal: RGB[], bg = OFF) {
  const out = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (data[i * 4 + 3] < 110) { out[i] = bg; continue; }
    const d = (BAYER[y & 3][x & 3] - 0.5) * 36;
    const r = data[i * 4] + d, g = data[i * 4 + 1] + d, b = data[i * 4 + 2] + d;
    let best = 0, bestD = Infinity;
    for (let k = 0; k < pal.length; k++) {
      const dr = r - pal[k][0], dg = g - pal[k][1], db = b - pal[k][2];
      const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dist < bestD) { bestD = dist; best = k; }
    }
    out[i] = best;
  }
  return out;
}

/** Draw anything with the canvas API at 4x, shrink it to one pixel per tile, and quantize it. */
export function rasterize(c: SceneCtx, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const S = 4;
  const big = document.createElement("canvas");
  big.width = c.cols * S; big.height = c.rows * S;
  const g = big.getContext("2d")!;
  g.fillStyle = c.hex[OFF];
  g.fillRect(0, 0, big.width, big.height);
  draw(g, big.width, big.height);
  const small = document.createElement("canvas");
  small.width = c.cols; small.height = c.rows;
  const sg = small.getContext("2d", { willReadFrequently: true })!;
  sg.imageSmoothingQuality = "high";
  sg.drawImage(big, 0, 0, c.cols, c.rows);
  return quantize(sg.getImageData(0, 0, c.cols, c.rows).data, c.cols, c.rows, c.pal);
}

// ---- Abstract ----

const waves: Scene = { name: "Waves", build: (c) => { const p = c.seed * 0.001; return field(c, R_GREEN, (x, y) => 0.5 + 0.28 * Math.sin(x * 0.22 + p + Math.sin(y * 0.55 + p * 0.7) * 1.4) + 0.22 * Math.sin(y * 0.9 - x * 0.09 + p * 1.3)); } };

const rings: Scene = { name: "Ripples", build: (c) => { const p = c.seed * 0.001, cx = c.cols * (0.35 + 0.3 * Math.abs(Math.sin(p))), cy = c.rows / 2; return field(c, R_COOL, (x, y) => 0.5 + 0.5 * Math.sin(Math.hypot(x - cx, (y - cy) * 1.4) * 0.8 - p)); } };

const plasma: Scene = { name: "Plasma", build: (c) => { const p = c.seed * 0.001; return field(c, R_PLASMA, (x, y) => (Math.sin(x * 0.18 + p) + Math.sin(y * 0.5 + p * 1.3) + Math.sin((x + y) * 0.12 + p * 0.7) + Math.sin(Math.hypot(x - c.cols / 2, (y - c.rows / 2) * 2) * 0.25 - p)) / 8 + 0.5); } };

const dunes: Scene = { name: "Dunes", build: (c) => { const p = c.seed * 0.001; return field(c, R_SUN, (x, y) => y / c.rows + 0.2 * Math.sin(x * 0.12 + p) + 0.1 * Math.sin(x * 0.31 + p * 2) - 0.1); } };

// ---- Illustrations, drawn with the canvas and pixelated ----

const hill = (g: CanvasRenderingContext2D, w: number, base: number, amp: number, freq: number, phase: number, color: string, h: number) => {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) g.lineTo(x, base + Math.sin(x * freq + phase) * amp);
  g.lineTo(w, h); g.closePath(); g.fill();
};

const sunrise: Scene = { name: "Sunrise", build: (c) => rasterize(c, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.78);
  sky.addColorStop(0, c.hex[P6]); sky.addColorStop(0.55, c.hex[P2]); sky.addColorStop(1, c.hex[Y2]);
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.35; g.fillStyle = c.hex[Y2]; g.beginPath(); g.arc(w * 0.5, h * 0.7, h * 0.55, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  g.fillStyle = c.hex[O5]; g.beginPath(); g.arc(w * 0.5, h * 0.7, h * 0.34, 0, Math.PI * 2); g.fill();
  const p = c.seed * 0.01;
  hill(g, w, h * 0.74, h * 0.07, 0.006, p, c.hex[T6], h);
  hill(g, w, h * 0.84, h * 0.06, 0.009, p + 2, c.hex[G7], h);
  hill(g, w, h * 0.93, h * 0.04, 0.013, p + 4, c.hex[OFF], h);
}) };

const bloom: Scene = { name: "Bloom", build: (c) => rasterize(c, (g, w, h) => {
  const colors = [c.hex[G5], c.hex[T3], c.hex[Y2], c.hex[P2]];
  const flower = (cx: number, cy: number, k: number, offset: number) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + offset;
      g.fillStyle = colors[i % colors.length];
      g.beginPath(); g.ellipse(cx + Math.cos(a) * h * 0.26 * k, cy + Math.sin(a) * h * 0.26 * k, h * 0.3 * k, h * 0.1 * k, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = c.hex[O5]; g.beginPath(); g.arc(cx, cy, h * 0.13 * k, 0, Math.PI * 2); g.fill();
  };
  flower(w * 0.18, h * 0.55, 0.7, 0.3); flower(w * 0.82, h * 0.45, 0.7, 0.1); flower(w * 0.5, h * 0.5, 1, 0);
}) };

const bauhaus: Scene = { name: "Shapes", build: (c) => rasterize(c, (g, w, h) => {
  const r = rng(c.seed), colors = [c.hex[G7], c.hex[G5], c.hex[T6], c.hex[Y2], c.hex[O5], c.hex[P6], c.hex[P2], c.hex[T3]];
  const col = () => colors[Math.floor(r() * colors.length)];
  g.fillStyle = c.hex[PAPER]; g.fillRect(0, 0, w, h);
  for (let x = 0, k = 0; x < w; x += h, k++) {
    const a = col(); let b = col(); while (b === a) b = col();
    g.fillStyle = b; g.fillRect(x, 0, h, h);
    g.fillStyle = a;
    const kind = Math.floor(r() * 5), q = Math.floor(r() * 4);
    g.save(); g.beginPath(); g.rect(x, 0, h, h); g.clip();
    if (kind === 0) { g.beginPath(); g.arc(x + h / 2, h / 2, h * 0.38, 0, Math.PI * 2); g.fill(); }
    else if (kind === 1) { g.beginPath(); g.arc(x + (q % 2 ? h : 0), q > 1 ? h : 0, h * 0.95, 0, Math.PI * 2); g.fill(); }
    else if (kind === 2) { g.fillRect(x, q % 2 ? 0 : h / 2, h, h / 2); }
    else if (kind === 3) { for (let s = 0; s < 3; s++) g.fillRect(x + s * (h / 3) + h * 0.06, 0, h * 0.2, h); }
    else { g.beginPath(); g.moveTo(x, q % 2 ? 0 : h); g.lineTo(x + h, q > 1 ? 0 : h); g.lineTo(x + (q % 2 ? h : 0), q % 2 ? h : 0); g.closePath(); g.fill(); }
    g.restore();
  }
}) };

// ---- Images and text ----

const loaded = new Map<string, Promise<HTMLImageElement>>();
const load = (src: string) => {
  let p = loaded.get(src);
  if (!p) { p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); loaded.set(src, p); }
  return p;
};

/** Any picture (PNG, SVG, JPG) becomes tiles. It is fitted inside the board with a little room around it. */
export function imageScene(src: string, name = "Picture"): Scene {
  return { name, build: async (c) => {
    const img = await load(src);
    return rasterize(c, (g, w, h) => {
      const k = Math.min(w / img.width, h / img.height) * 0.9;
      g.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k);
    });
  } };
}

/** A short line in big letters. Throws when the board is too small for it to be readable, so the board skips the scene. */
export function textScene(text: string, name = "Hello"): Scene {
  return { name, build: (c) => rasterize(c, (g, w, h) => {
    let px = h * 0.8;
    const set = () => { g.font = `700 ${px}px "National 2", system-ui, sans-serif`; };
    set();
    while (g.measureText(text).width > w * 0.92 && px > 8) { px -= 2; set(); }
    if (px < h * 0.72) throw new Error("board too small for this text");
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = c.hex[G2];
    g.fillText(text, w / 2, h * 0.56);
  }) };
}

export const ABSTRACT: Scene[] = [waves, rings, plasma, dunes];
export const ILLUSTRATIONS: Scene[] = [sunrise, bloom, bauhaus];
