"use client";

import { useEffect, useState } from "react";
import { DetailedIconLibrary } from "@/components/brand/DetailedIconLibrary";
import { IconLibrary } from "@/components/brand/IconLibrary";
import { Icon } from "@/components/ui/Icon";

type Set = "ui" | "detailed";

/** The Icons page: the one-color interface icons, and the larger two-color ones. The choice is in the address (?set=detailed) so it can be linked. */
export function IconsView() {
  const [set, setSet] = useState<Set>("ui");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get("set") === "detailed") setSet("detailed");
  }, []);
  const choose = (s: Set) => {
    setSet(s);
    const u = new URL(window.location.href);
    if (s === "ui") u.searchParams.delete("set"); else u.searchParams.set("set", s);
    window.history.replaceState(null, "", u);
  };
  return (
    <>
      <div suppressHydrationWarning className="seg mb-6" role="group" aria-label="Icon set">
        {([["ui", "UI icons", "droplet"], ["detailed", "Detailed icons", "droplets"]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => choose(id)} aria-pressed={set === id} className="seg-item"><Icon name={icon} size={14} />{label}</button>
        ))}
      </div>
      {set === "ui" ? <IconLibrary /> : <DetailedIconLibrary />}
    </>
  );
}
