"use client";

import { useSyncExternalStore } from "react";
import { isJira } from "@/lib/data/mode";

// Profile pictures. The browser reads one small index (who has a picture, and which version) and then only
// requests pictures that exist, so people without one cost nothing. Demo mode keeps your picture in this browser.

type Map = Record<string, number>;
const DEMO_KEY = "hub-demo-avatar";
const SIZE = 256;

let map: Map = {};
let demo: string | null = null;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isJira) {
    try { demo = localStorage.getItem(DEMO_KEY); } catch { /* private window */ }
    emit();
    return;
  }
  fetch("/api/avatars", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => { if (b?.avatars) { map = b.avatars; emit(); } })
    .catch(() => {});
}

function subscribe(f: () => void) {
  subs.add(f);
  start();
  return () => { subs.delete(f); };
}

/** The picture URL for this person, or undefined when they use initials. */
export function useAvatarUrl(id?: string): string | undefined {
  const url = useSyncExternalStore(
    subscribe,
    () => (!id ? undefined : isJira ? (map[id] ? `/api/avatars/${encodeURIComponent(id)}?v=${map[id]}` : undefined) : id === "u-avery" ? demo ?? undefined : undefined),
    () => undefined,
  );
  return url;
}

/** Crops to a centered square and shrinks, so a 12 MB phone photo uploads as about 20 KB. */
async function toSquare(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) throw new Error("That file isn't a picture we can read. Use a JPG, PNG or WebP.");
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't prepare that picture."))), "image/webp", 0.85));
}

export async function uploadAvatar(file: File, myId: string): Promise<void> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPG, PNG or WebP).");
  const blob = await toSquare(file);
  if (!isJira) {
    const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
    try { localStorage.setItem(DEMO_KEY, url); } catch { /* private window */ }
    demo = url;
    emit();
    return;
  }
  const r = await fetch("/api/avatars", { method: "POST", body: blob, headers: { "Content-Type": "image/webp" } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? `Couldn't save your picture (${r.status}).`);
  map = { ...map, [myId]: b.version };
  emit();
}

export async function removeAvatar(myId: string): Promise<void> {
  if (!isJira) {
    try { localStorage.removeItem(DEMO_KEY); } catch { /* private window */ }
    demo = null;
    emit();
    return;
  }
  const r = await fetch("/api/avatars", { method: "DELETE" });
  if (!r.ok) throw new Error(`Couldn't remove your picture (${r.status}).`);
  const next = { ...map };
  delete next[myId];
  map = next;
  emit();
}
