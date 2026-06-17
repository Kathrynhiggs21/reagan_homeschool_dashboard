import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Reagan's theme catalog — 5 themes (2026-06-17, Katy):
 *   1. chalkboard  — Black Chalkboard (kept; the original dark slate look)
 *   2. white       — White Basic (kept look: clean light version, same layout
 *                    + same per-subject colors)
 *   3. glass       — Glassmorphism — frosted translucent panels over a deep
 *                    cinematic gradient; thin light rims + soft pop-out.
 *   4. sunshine    — Bright & Colorful Card — clean light canvas with vivid
 *                    candy-colored cards and chunky pop-out shadows.
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
  glass:      { label: "Glassmorphism",    emoji: "🔮", description: "Frosted glass panels on a glowing night gradient.", swatch: "linear-gradient(135deg,#0b1020,#6366f1,#38bdf8)" },
  sunshine:   { label: "Bright & Colorful", emoji: "🌈", description: "Vivid candy cards with soft pop-out shadows.",  swatch: "linear-gradient(135deg,#60a5fa,#f472b6,#34d399)" },
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
