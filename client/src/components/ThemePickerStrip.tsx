import { useState, useRef, useEffect } from "react";
import { THEMES, THEME_PRIMARY, THEME_SECONDARY, useReaganTheme, type ThemeId } from "@/contexts/ReaganThemes";

/**
 * Theme picker strip. Renders the primary themes as pill buttons that switch
 * the global theme, plus a small "More" side button that opens a flyout for
 * the secondary themes (White Basic) so the plain white look stays available
 * without sitting in the main flow (2026-06-17, Katy).
 *
 * Readability: idle pill colors branch on whether the active theme is light so
 * the strip stays high-contrast on every theme/background.
 */
export default function ThemePickerStrip({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId } = useReaganTheme();
  const isLightTheme = themeId === "white" || themeId === "sunshine";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  // Close the "More" flyout on outside click.
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  // Idle (non-selected) pill colors are derived from the current theme so the
  // strip is always legible no matter which page or background it sits on.
  const idleBg = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const idleColor = isLightTheme ? "#3a2a00" : "#f4eedc";
  const idleBorder = isLightTheme ? "2px solid rgba(0,0,0,0.18)" : "2px solid rgba(255,255,255,0.15)";

  const containerBg = isLightTheme
    ? "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(0,0,0,0.04))"
    : themeId === "chalkboard"
      ? "linear-gradient(180deg, rgba(38,32,22,0.85), rgba(28,24,18,0.85))"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.18))";
  const containerBorder = isLightTheme
    ? "1px solid rgba(0,0,0,0.12)"
    : "1px solid rgba(220, 195, 130, 0.28)";
  const headerColor = isLightTheme ? "#3a2a00" : "#f4eedc";

  const pillStyle = (active: boolean) => ({
    background: active ? "rgba(255,216,106,0.95)" : idleBg,
    color: active ? "#3a2a00" : idleColor,
    border: active ? "2px solid #fff" : idleBorder,
    boxShadow: active
      ? "0 4px 0 rgba(0,0,0,0.35), 0 0 18px rgba(255,216,106,0.35)"
      : "0 2px 0 rgba(0,0,0,0.18)",
    transform: active ? "translateY(-1px)" : "none",
  });

  // Is one of the secondary (hidden) themes currently active? If so, surface it
  // on the "More" button so the user can see what's selected.
  const activeSecondary = THEME_SECONDARY.find((id) => id === themeId);

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
      {THEME_PRIMARY.map((id) => {
        const t = THEMES[id];
        const active = themeId === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => setThemeId(id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition"
            style={pillStyle(active)}
          >
            <span aria-hidden="true">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        );
      })}

      {/* "More" side button — tucks White Basic out of the main flow. */}
      <div className="relative" ref={moreRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          title="More themes"
          onClick={() => setMoreOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition"
          style={pillStyle(Boolean(activeSecondary))}
        >
          <span aria-hidden="true">{activeSecondary ? THEMES[activeSecondary].emoji : "⋯"}</span>
          <span>{activeSecondary ? THEMES[activeSecondary].label : "More"}</span>
        </button>
        {moreOpen && (
          <div
            role="menu"
            className="absolute right-0 bottom-full mb-2 z-50 w-48 rounded-xl border bg-popover text-popover-foreground shadow-xl p-1.5 space-y-0.5"
          >
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              More themes
            </div>
            {THEME_SECONDARY.map((id) => {
              const t = THEMES[id];
              const active = themeId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => { setThemeId(id); setMoreOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition ${
                    active ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-accent/60"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-black/20"
                    style={{ background: t.swatch }}
                    aria-hidden
                  />
                  <span className="flex-1 text-left truncate">{t.label}</span>
                  {active && <span className="text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
