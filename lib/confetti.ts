// A short burst of confetti across the screen. Draws on one temporary canvas and removes it when done.
// Skipped entirely for people who ask their system for reduced motion.
const COLORS = ["#08794a", "#089b5e", "#348289", "#5568bf", "#a95c18", "#a18102", "#8a3734", "#d6f5de"];

type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string; life: number };

export function confetti(): void {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const W = window.innerWidth, H = window.innerHeight;
  const parts: P[] = [];
  // Two cannons from the bottom corners, aimed across the screen, plus a light shower from the top.
  const fire = (x: number, dir: 1 | -1, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (-Math.PI / 2) + dir * (0.15 + Math.random() * 0.7);
      const s = 11 + Math.random() * 11;
      parts.push({ x, y: H + 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, color: COLORS[(Math.random() * COLORS.length) | 0], life: 0 });
    }
  };
  fire(0, 1, 70);
  fire(W, -1, 70);
  for (let i = 0; i < 40; i++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, color: COLORS[(Math.random() * COLORS.length) | 0], life: 0 });

  const start = performance.now();
  const DURATION = 3200;
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    const fade = t > DURATION - 700 ? Math.max(0, (DURATION - t) / 700) : 1;
    for (const p of parts) {
      p.vy += 0.28;      // gravity
      p.vx *= 0.992;     // air drag
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  // If the tab was hidden mid-animation the frames pause; this makes sure the canvas never lingers.
  setTimeout(() => canvas.remove(), DURATION + 1500);
}
