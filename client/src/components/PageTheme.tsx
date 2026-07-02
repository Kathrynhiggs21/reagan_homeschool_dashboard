import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * PageTheme — applies a per-route accent color + a `data-page` key on <html>
 * so each page reads as its own distinct space (accent glow, header treatment,
 * content arrangement) while reusing the existing, working page content.
 *
 * This is a low-risk differentiation lever: instead of rewriting every large
 * page, we vary the frame (accent, layout width, hero silhouette) around them.
 */

type PageMeta = { key: string; accent: string; accent2: string };

// r,g,b accents per route family. accent2 is the secondary glow.
const PAGE_MAP: Record<string, PageMeta> = {
  "/": { key: "today", accent: "56,189,248", accent2: "129,140,248" },
  "/today": { key: "today", accent: "56,189,248", accent2: "129,140,248" },
  "/schedule": { key: "schedule", accent: "129,140,248", accent2: "56,189,248" },
  "/kiwi": { key: "kiwi", accent: "52,211,153", accent2: "134,239,172" },
  "/coins": { key: "rewards", accent: "250,204,21", accent2: "251,146,60" },
  "/practice": { key: "practice", accent: "34,197,94", accent2: "132,204,22" },
  "/flashcards": { key: "practice", accent: "34,197,94", accent2: "132,204,22" },
  "/review": { key: "practice", accent: "34,197,94", accent2: "132,204,22" },
  "/bookshelf": { key: "books", accent: "244,114,182", accent2: "251,113,133" },
  "/notes": { key: "notes", accent: "96,165,250", accent2: "129,140,248" },
  "/apps": { key: "apps", accent: "251,191,36", accent2: "251,146,60" },
  "/curriculum": { key: "curriculum", accent: "96,165,250", accent2: "56,189,248" },
  "/agenda-editor": { key: "agenda", accent: "167,139,250", accent2: "129,140,248" },
  "/adventures": { key: "ideas", accent: "251,146,60", accent2: "250,204,21" },
  "/ixl": { key: "ixl", accent: "34,193,164", accent2: "45,212,191" },
  "/analytics": { key: "analytics", accent: "45,212,191", accent2: "52,211,153" },
  "/settings": { key: "settings", accent: "148,163,184", accent2: "129,140,248" },
  "/library": { key: "library", accent: "45,212,191", accent2: "96,165,250" },
  "/welcome": { key: "welcome", accent: "56,189,248", accent2: "129,140,248" },
};

const DEFAULT_META: PageMeta = { key: "today", accent: "56,189,248", accent2: "129,140,248" };

export default function PageTheme() {
  const [loc] = useLocation();

  useEffect(() => {
    const meta = PAGE_MAP[loc] ?? DEFAULT_META;
    const root = document.documentElement;
    root.setAttribute("data-page", meta.key);
    root.style.setProperty("--scene-accent", meta.accent);
    root.style.setProperty("--scene-accent-2", meta.accent2);
    return () => {
      // leave last value in place on unmount (route change re-runs effect)
    };
  }, [loc]);

  return null;
}
