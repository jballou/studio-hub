"use client";

import { useCallback, useEffect, useState } from "react";
import { favoritesRepo, type Favorite } from "@/lib/data/favorites";

/** My starred projects, kept in sync across the sidebar, the list and project pages. */
export function useFavorites() {
  const [items, setItems] = useState<Favorite[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => favoritesRepo.list().then((l) => { if (live) setItems(l); }).catch(() => {});
    load();
    window.addEventListener("favorites-changed", load);
    return () => { live = false; window.removeEventListener("favorites-changed", load); };
  }, []);
  const toggle = useCallback(async (key: string, title: string) => {
    const on = !items.some((f) => f.key === key);
    setItems((cur) => (on ? [{ key, title, addedAt: "" }, ...cur] : cur.filter((f) => f.key !== key))); // optimistic
    try { setItems(await favoritesRepo.set(key, title, on)); } catch { favoritesRepo.list().then(setItems); }
  }, [items]);
  return { items, isStarred: (key: string) => items.some((f) => f.key === key), toggle };
}
