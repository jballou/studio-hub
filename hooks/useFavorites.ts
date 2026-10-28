"use client";

import { useCallback, useEffect, useState } from "react";
import { favoritesRepo, type Favorite } from "@/lib/data/favorites";

/** My starred projects, kept in sync across the sidebar, the list and project pages. */
export function useFavorites() {
  const [items, setItems] = useState<Favorite[]>([]);
  useEffect(() => {
    let live = true;
    const load = (retry = true): void => { favoritesRepo.list().then((l) => { if (live) setItems(l); }).catch(() => { if (retry && live) setTimeout(() => load(false), 1500); }); };
    load();
    const onChange = () => load();
    window.addEventListener("favorites-changed", onChange);
    // Coming back to the tab picks up stars added elsewhere.
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { live = false; window.removeEventListener("favorites-changed", onChange); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  const toggle = useCallback(async (key: string, title: string) => {
    const on = !items.some((f) => f.key === key);
    setItems((cur) => (on ? [{ key, title, addedAt: "" }, ...cur] : cur.filter((f) => f.key !== key))); // optimistic
    try { setItems(await favoritesRepo.set(key, title, on)); } catch { favoritesRepo.list().then(setItems); }
  }, [items]);
  return { items, isStarred: (key: string) => items.some((f) => f.key === key), toggle };
}
