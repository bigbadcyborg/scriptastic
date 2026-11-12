import { useEffect } from "react";
import { usePrefs } from "@/lib/bible/prefs";

/** Applies the saved theme on every page, including sign-in and accounts. */
export function ThemeSync() {
  const prefs = usePrefs();

  useEffect(() => {
    if (!prefs.hydrated) return;
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.hydrated, prefs.theme]);

  return null;
}
