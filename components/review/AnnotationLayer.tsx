"use client";

import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Anchor, BoxAnchor } from "@/lib/types";

export type Pin = {
  id: string;
  number: number;
  anchor: Anchor;
  resolved: boolean;
  editable: boolean;
};

type Corner = "nw" | "ne" | "sw" | "se";

type Drag =
  | { mode: "new"; sx: number; sy: number }
  | { mode: "move"; target: string; sx: number; sy: number; orig: Anchor; moved: boolean; locked: boolean }
  | { mode: "resize"; target: string; corner: Corner; orig: BoxAnchor };

const DRAFT = "__draft__";
const MIN_DRAG = 0.01;
const clamp = (n: number) => Math.min(1, Math.max(0, n));

function boxFrom(ax: number, ay: number, bx: number, by: number): BoxAnchor {
  return { kind: "box", x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}

function shift(a: Anchor, dx: number, dy: number): Anchor {
  if (a.kind === "dot") return { kind: "dot", x: clamp(a.x + dx), y: clamp(a.y + dy) };
  return { ...a, x: Math.min(1 - a.w, Math.max(0, a.x + dx)), y: Math.min(1 - a.h, Math.max(0, a.y + dy)) };
}

export function AnnotationLayer({
  enabled, pins, selectedId, draft, onSelect, onDraftChange, onEditAnchor,
}: {
  /** When true, clicking the canvas drops a pin and dragging draws a box. */
  enabled: boolean;
  pins: Pin[];
  selectedId: string | null;
  draft: Anchor | null;
  onSelect: (id: string) => void;
  /** Called when a new anchor is drawn or the draft is moved/resized. */
  onDraftChange: (anchor: Anchor) => void;
  onEditAnchor: (id: string, anchor: Anchor) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [live, setLive] = useState<{ target: string; anchor: Anchor } | null>(null);

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = layerRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  const begin = (e: RPointerEvent, d: Drag) => {
    e.stopPropagation();
    layerRef.current!.setPointerCapture(e.pointerId);
    drag.current = d;
  };

  const onBackgroundDown = (e: RPointerEvent) => {
    if (!enabled) return;
    const p = norm(e);
    begin(e, { mode: "new", sx: p.x, sy: p.y });
    setLive({ target: DRAFT, anchor: { kind: "dot", x: p.x, y: p.y } });
  };

  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = norm(e);
    if (d.mode === "new") {
      const far = Math.max(Math.abs(p.x - d.sx), Math.abs(p.y - d.sy)) > MIN_DRAG;
      setLive({
        target: DRAFT,
        anchor: far ? boxFrom(d.sx, d.sy, p.x, p.y) : { kind: "dot", x: d.sx, y: d.sy },
      });
    } else if (d.mode === "move") {
      if (d.locked) return;
      const dx = p.x - d.sx;
      const dy = p.y - d.sy;
      if (!d.moved && Math.max(Math.abs(dx), Math.abs(dy)) < MIN_DRAG) return;
      d.moved = true;
      setLive({ target: d.target, anchor: shift(d.orig, dx, dy) });
    } else {
      const o = d.orig;
      const fixedX = d.corner.includes("w") ? o.x + o.w : o.x;
      const fixedY = d.corner.includes("n") ? o.y + o.h : o.y;
      setLive({ target: d.target, anchor: boxFrom(fixedX, fixedY, p.x, p.y) });
    }
  };

  const commit = (target: string, anchor: Anchor) => {
    if (target === DRAFT) onDraftChange(anchor);
    else onEditAnchor(target, anchor);
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "move" && !d.moved) {
      setLive(null);
      if (d.target !== DRAFT) onSelect(d.target);
      return;
    }
    if (live) {
      let a = live.anchor;
      if (a.kind === "box" && (a.w < MIN_DRAG || a.h < MIN_DRAG)) a = { kind: "dot", x: a.x, y: a.y };
      commit(live.target, a);
    }
    setLive(null);
  };

  const items: { id: string; number: number | null; anchor: Anchor; resolved: boolean; editable: boolean; isDraft: boolean }[] = [];
  for (const p of pins) {
    const anchor = live?.target === p.id ? live.anchor : p.anchor;
    items.push({ id: p.id, number: p.number, anchor, resolved: p.resolved, editable: p.editable, isDraft: false });
  }
  const draftAnchor = live?.target === DRAFT ? live.anchor : draft;
  if (draftAnchor) items.push({ id: DRAFT, number: null, anchor: draftAnchor, resolved: false, editable: true, isDraft: true });

  const cursor = enabled ? "crosshair" : "default";

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 touch-none select-none"
      style={{ cursor, pointerEvents: enabled ? "auto" : "none" }}
      onPointerDown={onBackgroundDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* Refs are only touched inside pointer handlers; the lint rule can't see that. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {items.map((it) => {
        const selected = it.id === selectedId;
        const color = it.isDraft ? "#d07a2f" : it.resolved ? "#686764" : "#08794a";
        const ring = it.isDraft ? "#f2d0a3" : it.resolved ? "#d7d3cc" : "#b0e8c3";
        const ink = it.isDraft ? "#1a1919" : "#ffffff"; // Orange 500 needs dark text
        const label = it.number ?? "+";
        const canEdit = it.editable && (it.isDraft || selected);
        const startMove = (e: RPointerEvent) => {
          if (!canEdit && !it.isDraft) {
            // Not editable: treat as a plain click-to-select.
            begin(e, { mode: "move", target: it.id, sx: 0, sy: 0, orig: it.anchor, moved: false, locked: true });
            return;
          }
          const p = norm(e);
          begin(e, { mode: "move", target: it.id, sx: p.x, sy: p.y, orig: it.anchor, moved: false, locked: false });
        };

        if (it.anchor.kind === "dot") {
          return (
            <div
              key={it.id}
              onPointerDown={startMove}
              className="pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-round text-xs font-bold shadow"
              style={{
                left: `${it.anchor.x * 100}%`, top: `${it.anchor.y * 100}%`, background: color, color: ink,
                outline: selected || it.isDraft ? `3px solid ${ring}` : "2px solid white",
                cursor: "pointer",
              }}
            >
              {label}
            </div>
          );
        }

        const b = it.anchor;
        return (
          <div
            key={it.id}
            onPointerDown={startMove}
            className="pointer-events-auto absolute"
            style={{
              left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`,
              border: `2px ${it.isDraft ? "dashed" : "solid"} ${color}`,
              cursor: "pointer",
              boxShadow: selected ? `0 0 0 3px ${ring}, 0 0 0 1px #fff inset` : "0 0 0 1px #fff",
            }}
          >
            <span
              className="absolute -left-0.5 -top-6 rounded-tight px-2 py-0 text-xs font-bold"
              style={{ background: color, color: ink }}
            >
              {label}
            </span>
            {canEdit &&
              (["nw", "ne", "sw", "se"] as Corner[]).map((c) => (
                <span
                  key={c}
                  onPointerDown={(e) => begin(e, { mode: "resize", target: it.id, corner: c, orig: b })}
                  className="absolute h-3 w-3 border-2 bg-white"
                  style={{
                    borderColor: color,
                    left: c.includes("w") ? -7 : undefined, right: c.includes("e") ? -7 : undefined,
                    top: c.includes("n") ? -7 : undefined, bottom: c.includes("s") ? -7 : undefined,
                    cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                  }}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
