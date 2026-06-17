import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Reagan's theme catalog — 5 themes (2026-06-17, Katy):
 *   1. chalkboard  — Black Chalkboard (kept; the original dark slate look)
 *   2. white       — White Basic (kept look: clean light version, same layout
 *                    + same per-subject colors)
 *   3. glass       — NEW: Bubble Glass — modern colorful glassmorphism, soft 3D
 *                    translucent cards, vivid candy accents.
 *   4. sunshine    — NEW: Sunshine Minimal — clean flat, rounded, cheerful and
 *                    very simple (lots of white space, big friendly shapes).
 *   5. galaxy      — NEW (AI pick that fits best): Galaxy Glow — deep indigo
 *                    space with neon aurora accents; calm but magical.
 *
 * Each theme is applied via the `data-rtheme` attribute on <html>, with the
 * matching CSS living in index.css. `swatch` is the little color dot shown in
 * the sidebar picker.
 */
export type ThemeId = "chalkboard" | "white" | "glass" | "sunshine" | "galaxy";

export const THEMES: Record<ThemeId, { label: string; emoji: string; description: string; swatch: string }> = {
  chalkboard: { label: "Black Chalkboard", emoji: "🖤", description: "Black slate with bright chalk. Calm & classic.", swatch: "#1f2421" },
  white:      { label: "White Basic",      emoji: "🤍", description: "Clean white classroom, same subject colors.",  swatch: "#f7f7f4" },
  glass:      { label: "Bubble Glass",     emoji: "🫧", description: "Colorful glass bubbles — modern & playful.",    swatch: "linear-gradient(135deg,#7dd3fc,#c4b5fd,#fbcfe8)" },
  sunshine:   { label: "Sunshine",         emoji: "🌼", description: "Bright, simple & flat. Lots of happy space.",   swatch: "linear-gradient(135deg,#fde68a,#fca5a5)" },
  galaxy:     { label: "Galaxy Glow",      emoji: "🌌", description: "Deep space with soft neon aurora glow.",        swatch: "linear-gradient(135deg,#312e81,#7c3aed,#22d3ee)" },
};

// Order shown in the picker.
export const THEME_ORDER: ThemeId[] = ["chalkboard", "white", "glass", "sunshine", "galaxy"];

// Migrate legacy theme ids (pre-2026-06-17) to the new catalog so saved prefs
// don't break. starry/notebook -> galaxy/white-ish closest matches.
const LEGACY: Record<string, ThemeId> = {
  starry: "galaxy",
  cream: "white",
  notebook: "white",
};
function normalize(v: string | null | undefined): ThemeId | null {
  if (!v) return null;
  if ((THEMES as any)[v]) return v as ThemeId;
  if (LEGACY[v]) return LEGACY[v];
  return null;
}

type Ctx = { themeId: ThemeId; setThemeId: (t: ThemeId) => void };
const ThemeCtx = createContext<Ctx>({ themeId: "chalkboard", setThemeId: () => {} });

const STORAGE_KEY = "reagan_theme_v1";

export function ReaganThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "chalkboard";
    return normalize(localStorage.getItem(STORAGE_KEY)) ?? "chalkboard";
  });

  // Hydrate from server pref (cross-device). Local storage is the fast fallback.
  const serverPref = trpc.prefs.getPublic.useQuery({ key: "ui.theme" });
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    const v = normalize(serverPref.data as string | null | undefined);
    if (v) {
      setThemeIdState(v);
      hydratedRef.current = true;
    } else if (serverPref.isFetched) {
      hydratedRef.current = true;
    }
  }, [serverPref.data, serverPref.isFetched]);

  const writePref = trpc.prefs.set.useMutation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-rtheme", themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  const setThemeId = (t: ThemeId) => {
    if (!THEMES[t]) return;
    setThemeIdState(t);
    try { writePref.mutate({ key: "ui.theme", value: t }); } catch { /* ok */ }
  };

  return <ThemeCtx.Provider value={{ themeId, setThemeId }}>{children}</ThemeCtx.Provider>;
}

export function useReaganTheme() {
  return useContext(ThemeCtx);
}
