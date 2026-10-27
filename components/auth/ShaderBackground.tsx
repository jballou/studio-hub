"use client";

import { useEffect, useRef } from "react";

// A slow, soft gradient made of five moving color blobs, drawn on the GPU. Colors come from the brand palette, with a
// deeper set for dark mode. It stands still for people who prefer reduced motion, and falls back to plain CSS if WebGL
// isn't available.
const LIGHT = ["#f7f5f3", "#d6f5de", "#089b5e", "#a6dce1", "#f2e2a6", "#c5ccf9"];
const DARK = ["#0b100d", "#105638", "#08794a", "#255b60", "#3f4d94", "#0f2e21"];

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = `
precision mediump float;
uniform vec2 r; uniform float t; uniform vec3 c[6];
vec3 blob(vec2 uv, vec2 center, vec3 col, float s){ float d = distance(uv, center); return col * exp(-d*d*s); }
void main(){
  vec2 uv = gl_FragCoord.xy / r; uv.x *= r.x / r.y;
  float a = r.x / r.y;
  // gentle domain warp so the shapes breathe instead of sliding
  uv += 0.06 * vec2(sin(uv.y*3.0 + t*0.35), cos(uv.x*3.0 - t*0.30));
  vec3 acc = c[0] * 0.30; float w = 0.30;
  vec2 p1 = vec2(a*0.25 + 0.20*sin(t*0.21), 0.30 + 0.20*cos(t*0.17));
  vec2 p2 = vec2(a*0.80 + 0.22*cos(t*0.19), 0.25 + 0.22*sin(t*0.23));
  vec2 p3 = vec2(a*0.55 + 0.25*sin(t*0.15+1.0), 0.75 + 0.15*cos(t*0.27));
  vec2 p4 = vec2(a*0.15 + 0.15*cos(t*0.25+2.0), 0.85 + 0.12*sin(t*0.20));
  vec2 p5 = vec2(a*0.90 + 0.12*sin(t*0.22+3.0), 0.80 + 0.15*cos(t*0.18));
  float k = 4.2;
  acc += blob(uv,p1,c[1],k); w += exp(-pow(distance(uv,p1),2.)*k);
  acc += blob(uv,p2,c[2],k*1.6); w += exp(-pow(distance(uv,p2),2.)*k*1.6);
  acc += blob(uv,p3,c[3],k); w += exp(-pow(distance(uv,p3),2.)*k);
  acc += blob(uv,p4,c[4],k*1.3); w += exp(-pow(distance(uv,p4),2.)*k*1.3);
  acc += blob(uv,p5,c[5],k*1.3); w += exp(-pow(distance(uv,p5),2.)*k*1.3);
  gl_FragColor = vec4(acc / w, 1.0);
}`;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

export function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return; // the CSS fallback behind the canvas stays visible
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const colors = (dark ? DARK : LIGHT).flatMap(rgb);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("Shader:", gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "r"), uT = gl.getUniformLocation(prog, "t"), uC = gl.getUniformLocation(prog, "c");
    gl.uniform3fv(uC, new Float32Array(colors));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uR, canvas.width, canvas.height);
    };
    const draw = (t: number) => { gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    resize();
    window.addEventListener("resize", resize);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (still) draw(6);
    else {
      const start = performance.now();
      const loop = (now: number) => { draw((now - start) / 1000 + 4); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }
    // Don't force-lose the context here: React runs effects twice in development and the second run reuses this canvas.
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,#d6f5de,#f7f5f3_45%,#f2e2a6)] [html[data-theme=dark]_&]:bg-none">
      <canvas ref={ref} className="h-full w-full" />
    </div>
  );
}
