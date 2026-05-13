import { THEMES, useReaganTheme, type ThemeId } from "@/contexts/ReaganThemes";

const ORDER: ThemeId[] = ["starry", "cream", "chalkboard", "notebook"];

/**
 * Theme picker strip. Renders four pill buttons that switch the global theme.
 *
 * Readability: the strip used to assume a dark backdrop, which made the idle
 * pills pale-on-pale on the Cream / Notebook (light) themes. We now branch
 * idle button colors on whether the active theme is light, so every theme
 * stays high-contrast.
 */
export default function ThemePickerStrip({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId } = useReaganTheme();
  const isLightTheme = themeId === "cream" || themeId === "notebook";

  // Idle (non-selected) pill colors are derived from the current theme so the
  // strip is always legible no matter which page or background it sits on.
  const idleBg = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const idleColor = isLightTheme ? "#3a2a00" : "#f4eedc";
  const idleBorder = isLightTheme ? "2px solid rgba(0,0,0,0.18)" : "2px solid rgba(255,255,255,0.15)";

  // Container also swaps for light themes so the picker isn't a dark
  // panel slapped onto a cream page. Push 60 (2026-05-13): on the pure-
  // black Chalkboard Night theme the previous container gradient washed
  // into the body background, so we now use a slightly warmer slate so
  // the picker reads as its own card, not a smudge on the page.
  const containerBg = isLightTheme
    ? "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(0,0,0,0.04))"
    : themeId === "chalkboard"
      ? "linear-gradient(180deg, rgba(38,32,22,0.85), rgba(28,24,18,0.85))"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.18))";
  const containerBorder = isLightTheme
    ? "1px solid rgba(0,0,0,0.12)"
    : "1px solid rgba(220, 195, 130, 0.28)";
  const headerColor = isLightTheme ? "#3a2a00" : "#f4eedc";

  return (
    <div
      className="rounded-2xl p-3 flex items-center gap-2 flex-wrap"
      style={{
        background: containerBg,
        border: containerBorder,
        boxShadow: "0 4px 0 rgba(0,0,0,0.18)",
      }}
    >
      {!compact && (
        <span className="font-display font-semibold text-sm mr-1" style={{ color: headerColor }}>🎨 Theme:</span>
      )}
      {ORDER.map((id) => {
        const t = THEMES[id];
        const active = themeId === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => setThemeId(id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition"
            style={{
              background: active ? "rgba(255,216,106,0.95)" : idleBg,
              color: active ? "#3a2a00" : idleColor,
              border: active ? "2px solid #fff" : idleBorder,
              boxShadow: active
                ? "0 4px 0 rgba(0,0,0,0.35), 0 0 18px rgba(255,216,106,0.35)"
                : "0 2px 0 rgba(0,0,0,0.18)",
              transform: active ? "translateY(-1px)" : "none",
            }}
          >
            <span aria-hidden="true">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
