// Sound effects, used sparingly: a celebration when work is finished and a good-night when dark mode turns on.
// People can mute them with the speaker button; the choice is remembered in this browser.
export type Sfx = "celebrate" | "night";

const FILES: Record<Sfx, string> = { celebrate: "/sounds/celebrate.wav", night: "/sounds/night-night.wav" };
const KEY = "hub-sounds";

export function soundsOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSounds(on: boolean): void {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event("sounds-changed"));
}

/** Plays a sound unless muted. Browsers only allow sound after a click or key press; if blocked, it silently does nothing. */
export function playSfx(name: Sfx, volume = 0.6): void {
  if (typeof window === "undefined" || !soundsOn()) return;
  try {
    const a = new Audio(FILES[name]);
    a.volume = volume;
    void a.play().catch(() => {});
  } catch { /* no audio available */ }
}
