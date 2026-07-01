import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Theme-registry default/recommended contract (Katy 2026-07-01).
 *
 * The redesigned "glass" theme (clear 3D liquid glass over photorealistic
 * nature + two budgies) is the canonical, recommended look, and must be the
 * DEFAULT for first-time visitors who have no saved theme preference. These
 * are pure source-text checks (the suite runs in a `node` environment, no DOM),
 * so a future edit can't silently regress glass back to a non-default.
 */
const themesPath = join(__dirname, "..", "client", "src", "contexts", "ReaganThemes.tsx");
const themes = readFileSync(themesPath, "utf8");

const mainPath = join(__dirname, "..", "client", "src", "main.tsx");
const main = readFileSync(mainPath, "utf8");

const pickerPath = join(__dirname, "..", "client", "src", "components", "SidebarThemePicker.tsx");
const picker = readFileSync(pickerPath, "utf8");

describe("theme registry — glass is the default + recommended", () => {
  it("exports DEFAULT_THEME = glass", () => {
    expect(themes).toMatch(/export const DEFAULT_THEME:\s*ThemeId\s*=\s*"glass"/);
  });

  it("exports RECOMMENDED_THEME = glass", () => {
    expect(themes).toMatch(/export const RECOMMENDED_THEME:\s*ThemeId\s*=\s*"glass"/);
  });

  it("uses DEFAULT_THEME (not a hardcoded chalkboard) for the initial context + state", () => {
    // Context default value
    expect(themes).toMatch(/createContext<Ctx>\(\{\s*themeId:\s*DEFAULT_THEME/);
    // useState initializer falls back to DEFAULT_THEME, both SSR + client branches
    expect(themes).toMatch(/if \(typeof window === "undefined"\) return DEFAULT_THEME;/);
    expect(themes).toMatch(/localStorage\.getItem\(STORAGE_KEY\)\)\s*\?\?\s*DEFAULT_THEME;/);
    // No lingering hardcoded chalkboard default in the provider init
    expect(themes).not.toMatch(/\?\?\s*"chalkboard"/);
    expect(themes).not.toMatch(/return "chalkboard";/);
  });

  it("boots the first paint into glass when there is no saved pref (main.tsx bootstrap)", () => {
    // Early bootstrap resolves to glass when localStorage has nothing valid.
    expect(main).toContain('localStorage.getItem("reagan_theme_v1")');
    expect(main).toMatch(/:\s*"glass";/); // final fallback in the resolved ternary
    expect(main).toMatch(/setAttribute\("data-rtheme", resolved\)/);
    // Dark class engaged for the dark themes (incl. glass) so `dark:` variants fire.
    expect(main).toMatch(/resolved === "glass"/);
  });

  it("keeps glass first in the primary picker order", () => {
    expect(themes).toMatch(/THEME_PRIMARY:\s*ThemeId\[\]\s*=\s*\[\s*"glass"/);
  });

  it("does not migrate away from a user's explicitly saved non-glass theme", () => {
    // The bootstrap must honor a valid saved value (only unsaved/invalid -> glass).
    expect(main).toMatch(/VALID\.has\(raw\)\s*\?\s*raw/);
  });

  it("surfaces a Recommended badge on the recommended theme row in the picker", () => {
    expect(picker).toContain("RECOMMENDED_THEME");
    expect(picker).toMatch(/recommended=\{id === RECOMMENDED_THEME\}/);
    expect(picker).toMatch(/aria-label="Recommended"/);
  });
});
