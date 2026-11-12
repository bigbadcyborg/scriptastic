import { useEffect, useState } from "react";

const KEY = "scriptastic-v1";

export type SavedVerse = {
  id: string;
  translation: string;
  book: number;
  chapter: number;
  verse: number;
  text: string;
};

export type Scale = 1 | 2 | 3;

export type ThemeId = "night" | "parchment" | "vespers" | "cedar";

export const THEMES: { id: ThemeId; name: string; note: string; swatch: [string, string, string] }[] = [
  { id: "night", name: "Night", note: "Near-black and ivory", swatch: ["#0c0b0a", "#24211c", "#f3efe6"] },
  { id: "parchment", name: "Parchment", note: "Warm paper and ink", swatch: ["#f3ecdf", "#fffaf2", "#241c14"] },
  { id: "vespers", name: "Vespers", note: "Deep blue and silver", swatch: ["#10141c", "#242b3d", "#e6e9f0"] },
  { id: "cedar", name: "Cedar", note: "Dark wood and cream", swatch: ["#1a1410", "#3a2c22", "#f0e2d0"] },
];

type Persisted = {
  translation?: string;
  scale?: Scale;
  theme?: ThemeId;
  saved?: SavedVerse[];
  recent?: string[];
};

export function usePrefs() {
  const [translation, setTranslation] = useState("kjv");
  const [scale, setScale] = useState<Scale>(2);
  const [theme, setTheme] = useState<ThemeId>("night");
  const [saved, setSaved] = useState<SavedVerse[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as Persisted;
        if (typeof data.translation === "string") setTranslation(data.translation);
        if (data.scale === 1 || data.scale === 2 || data.scale === 3) setScale(data.scale);
        if (data.theme && THEMES.some((item) => item.id === data.theme)) setTheme(data.theme);
        if (Array.isArray(data.saved)) setSaved(data.saved.slice(0, 200));
        if (Array.isArray(data.recent)) setRecent(data.recent.filter((item) => typeof item === "string").slice(0, 8));
      }
    } catch {
      /* ignore damaged local notes */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: Persisted = { translation, scale, theme, saved, recent };
    localStorage.setItem(KEY, JSON.stringify(payload));
  }, [hydrated, translation, scale, theme, saved, recent]);

  function remember(query: string) {
    const next = query.trim();
    if (next.length < 2) return;
    setRecent((current) => [next, ...current.filter((item) => item.toLowerCase() !== next.toLowerCase())].slice(0, 8));
  }

  function toggleSaved(entry: SavedVerse) {
    setSaved((current) => {
      const exists = current.some((item) => item.id === entry.id);
      if (exists) return current.filter((item) => item.id !== entry.id);
      return [entry, ...current].slice(0, 200);
    });
  }

  return {
    hydrated,
    translation,
    setTranslation,
    scale,
    setScale,
    theme,
    setTheme,
    saved,
    toggleSaved,
    recent,
    remember,
  };
}
