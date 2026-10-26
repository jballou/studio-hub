import { isJira } from "./mode";

export type Favorite = { key: string; title: string; addedAt: string };

export interface FavoritesRepo {
  list(): Promise<Favorite[]>;
  set(key: string, title: string, on: boolean): Promise<Favorite[]>;
}

const changed = () => typeof window !== "undefined" && window.dispatchEvent(new Event("favorites-changed"));

const jiraFavorites: FavoritesRepo = {
  async list() {
    const res = await fetch("/api/favorites", { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()).favorites as Favorite[];
  },
  async set(key, title, on) {
    const res = await fetch("/api/favorites", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, title, on }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Couldn't update favorites.");
    changed();
    return body.favorites as Favorite[];
  },
};

const LS = "favorites-demo-v1";
const read = (): Favorite[] => { try { return JSON.parse(localStorage.getItem(LS) ?? "[]"); } catch { return []; } };
const demoFavorites: FavoritesRepo = {
  async list() { return read(); },
  async set(key, title, on) {
    const items = on ? [{ key, title, addedAt: new Date().toISOString() }, ...read().filter((f) => f.key !== key)] : read().filter((f) => f.key !== key);
    try { localStorage.setItem(LS, JSON.stringify(items)); } catch { /* ignore */ }
    changed();
    return items;
  },
};

export const favoritesRepo: FavoritesRepo = isJira ? jiraFavorites : demoFavorites;
