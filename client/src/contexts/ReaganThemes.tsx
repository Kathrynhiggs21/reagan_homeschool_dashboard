import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeId = "starry" | "cream" | "chalkboard" | "notebook";

export const THEMES: Record<ThemeId, { label: string; emoji: string; description: string }> = {
  starry:     { label: "Starry Chalkboard", emoji: "🌙", description: "Deep night with warm pastel chalk — cozy & magical." },
  cream:      { label: "Cream Homeschool",  emoji: "✏️", description: "Soft cream paper with rainbow pastel letters — printed planner feel." },
  chalkboard: { label: "Chalkboard Night",  emoji: "🖤", description: "Pure black slate with clean chalk. Minimal & calm." },
  notebook:   { label: "Notebook Doodle",   emoji: "📓", description: "Notebook paper with blue lines & red margin." },
};

type Ctx = { themeId: ThemeId; setThemeId: (t: ThemeId) => void };
const ThemeCtx = createContext<Ctx>({ themeId: "starry", setThemeId: () => {} });

const STORAGE_KEY = "reagan_theme_v1";

export function ReaganThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "starry";
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return saved && THEMES[saved] ? saved : "starry";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-rtheme", themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  const setThemeId = (t: ThemeId) => {
    if (!THEMES[t]) return;
    setThemeIdState(t);
  };

  return <ThemeCtx.Provider value={{ themeId, setThemeId }}>{children}</ThemeCtx.Provider>;
}

export function useReaganTheme() {
  return useContext(ThemeCtx);
}
