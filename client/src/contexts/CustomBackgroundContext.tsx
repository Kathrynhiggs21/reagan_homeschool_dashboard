/**
 * CustomBackgroundContext
 * -----------------------
 * Lets Reagan pick her own background for the dashboard:
 *   - solid color (any hex / pastel preset)
 *   - uploaded image (data URL stored in localStorage; small files only)
 *   - or "none" (use the active theme default)
 *
 * Applied to the document via CSS custom properties:
 *   --reagan-bg-color   (color)
 *   --reagan-bg-image   (url)
 *
 * The shell reads these in CozyShell with `style={{ background: ... }}`.
 *
 * NOTE: We persist *locally* tonight (localStorage) because piping a
 * Drive-backed user preference would require a schema migration. The
 * preference travels with the browser; that's fine for a single-kid
 * dashboard. A future checkpoint can move this server-side under
 * `userPrefs.backgroundColor` / `userPrefs.backgroundUrl` cleanly.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type BackgroundChoice = {
  kind: "none" | "color" | "image";
  color?: string;     // CSS color, used when kind === "color"
  imageUrl?: string;  // data URL or remote URL, used when kind === "image"
};

const STORAGE_KEY = "reagan_custom_bg_v1";

type Ctx = {
  bg: BackgroundChoice;
  setColor: (color: string) => void;
  setImage: (imageUrl: string) => void;
  clear: () => void;
};

const Default: Ctx = {
  bg: { kind: "none" },
  setColor: () => {},
  setImage: () => {},
  clear: () => {},
};

const BgCtx = createContext<Ctx>(Default);

export function CustomBackgroundProvider({ children }: { children: ReactNode }) {
  const [bg, setBg] = useState<BackgroundChoice>(() => {
    if (typeof window === "undefined") return { kind: "none" };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { kind: "none" };
      const parsed = JSON.parse(raw) as BackgroundChoice;
      if (parsed && (parsed.kind === "color" || parsed.kind === "image" || parsed.kind === "none")) {
        return parsed;
      }
    } catch {
      // ignore parse errors and fall back
    }
    return { kind: "none" };
  });

  // Keep CSS custom properties in sync with the chosen background.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (bg.kind === "color" && bg.color) {
      root.style.setProperty("--reagan-bg-color", bg.color);
      root.style.setProperty("--reagan-bg-image", "none");
      root.setAttribute("data-rbg", "color");
    } else if (bg.kind === "image" && bg.imageUrl) {
      root.style.setProperty("--reagan-bg-image", `url("${bg.imageUrl}")`);
      root.style.removeProperty("--reagan-bg-color");
      root.setAttribute("data-rbg", "image");
    } else {
      root.style.removeProperty("--reagan-bg-color");
      root.style.removeProperty("--reagan-bg-image");
      root.setAttribute("data-rbg", "none");
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bg));
    } catch {
      // localStorage may be full from a big image — silently swallow
    }
  }, [bg]);

  return (
    <BgCtx.Provider
      value={{
        bg,
        setColor: (color) => setBg({ kind: "color", color }),
        setImage: (imageUrl) => setBg({ kind: "image", imageUrl }),
        clear: () => setBg({ kind: "none" }),
      }}
    >
      {children}
    </BgCtx.Provider>
  );
}

export function useCustomBackground() {
  return useContext(BgCtx);
}

/**
 * Helper: read a File as a data URL safely with a max-size guard.
 * Returns null if the file is too big (over `maxBytes`) so callers can
 * surface a friendly error instead of bricking localStorage.
 */
export function readFileAsDataUrl(file: File, maxBytes = 1_500_000): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  });
}
