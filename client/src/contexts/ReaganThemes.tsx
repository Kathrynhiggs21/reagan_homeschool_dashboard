import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

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

  // Hydrate from server pref (works across devices). Local storage stays as a fast fallback.
  const serverPref = trpc.prefs.getPublic.useQuery({ key: "ui.theme" });
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    const v = serverPref.data as string | null | undefined;
    if (v && (THEMES as any)[v]) {
      setThemeIdState(v as ThemeId);
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
    // Best-effort server persistence (no-op if not signed in).
    try { writePref.mutate({ key: "ui.theme", value: t }); } catch { /* ok */ }
  };

  return <ThemeCtx.Provider value={{ themeId, setThemeId }}>{children}</ThemeCtx.Provider>;
}

export function useReaganTheme() {
  return useContext(ThemeCtx);
}
