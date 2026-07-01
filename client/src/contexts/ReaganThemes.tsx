import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Reagan's theme system — CANONICAL SINGLE THEME (2026-07-01, Katy).
 *
 * Katy's direction: remove ALL chalkboard / flat / multi-theme options and
 * ship ONE canonical look — clear 3D liquid glass over photorealistic nature,
 * with floating glass objects (never flat boxes), cast shadows, and the two
 * budgies as a side accent. There is no theme picker anymore; the whole app
 * always renders `data-rtheme="glass"`.
 *
 * The `useReaganTheme` hook is kept (returning the fixed glass theme) so the
 * handful of components/pages that import it keep compiling without a large
 * refactor. Switching is a no-op now.
 */
export type ThemeId = "glass";

export const THEMES: Record<ThemeId, { label: string; emoji: string; description: string; swatch: string }> = {
  glass: {
    label: "Liquid Glass",
    emoji: "🔮",
    description: "Clear 3D liquid glass over real nature with two budgies.",
    swatch: "linear-gradient(135deg,#7dd3fc,#a5b4fc,#fcd34d)",
  },
};

// Kept for any legacy imports; all collapse to the single glass theme.
export const THEME_ORDER: ThemeId[] = ["glass"];
export const THEME_PRIMARY: ThemeId[] = ["glass"];
export const THEME_SECONDARY: ThemeId[] = [];
export const DEFAULT_THEME: ThemeId = "glass";
export const RECOMMENDED_THEME: ThemeId = "glass";

type Ctx = { themeId: ThemeId; setThemeId: (t: ThemeId) => void };
const ThemeCtx = createContext<Ctx>({ themeId: "glass", setThemeId: () => {} });

export function ReaganThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    // One canonical theme, always. `.dark` stays on so every `dark:` utility
    // variant engages against the deep translucent glass surfaces.
    root.setAttribute("data-rtheme", "glass");
    root.classList.add("dark");
  }, []);

  // setThemeId is intentionally a no-op — there is only one theme now.
  return <ThemeCtx.Provider value={{ themeId: "glass", setThemeId: () => {} }}>{children}</ThemeCtx.Provider>;
}

export function useReaganTheme() {
  return useContext(ThemeCtx);
}
