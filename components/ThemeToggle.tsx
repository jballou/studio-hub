"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { playSfx, setSounds, soundsOn } from "@/lib/sfx";

const KEY = "hub-theme";

/** Light/dark switch and a mute button for the sound effects. Going dark plays the good-night sound; going light plays the mischievous one. */
export function ThemeToggle({ vertical = false }: { vertical?: boolean }) {
  const [dark, setDark] = useState(false);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    // Read what the head script already applied; this runs once on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
    setSound(soundsOn());
    const onSounds = () => setSound(soundsOn());
    window.addEventListener("sounds-changed", onSounds);
    return () => window.removeEventListener("sounds-changed", onSounds);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem(KEY, next ? "dark" : "light"); } catch { /* storage unavailable */ }
    playSfx(next ? "night" : "day");
  };

  const btn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-n-800 hover:bg-n-150";
  return (
    <div className={`flex ${vertical ? "flex-col" : ""} items-center`}>
      <button onClick={toggleTheme} aria-pressed={dark} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} className={btn}>
        <Icon name={dark ? "sun" : "moon"} size={18} />
      </button>
      <button onClick={() => setSounds(!sound)} aria-pressed={sound} aria-label={sound ? "Mute sound effects" : "Turn on sound effects"} title={sound ? "Sounds on" : "Sounds off"} className={btn}>
        <Icon name={sound ? "volumeOn" : "volumeOff"} size={18} />
      </button>
    </div>
  );
}
