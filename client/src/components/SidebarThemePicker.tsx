import { useState } from "react";
import { THEMES, THEME_ORDER, useReaganTheme, type ThemeId } from "@/contexts/ReaganThemes";

/**
 * SidebarThemePicker — pinned at the bottom-left of the sidebar so Reagan can
 * change how her classroom looks from anywhere.
 *
 * Collapsed sidebar  → a single swatch button that opens a little flyout list.
 * Expanded sidebar   → a compact labeled list of the themes.
 *
 * The theme list itself lives in ReaganThemes (single source of truth) so the
 * picker automatically reflects however many themes exist.
 */
export default function SidebarThemePicker({ collapsed = false }: { collapsed?: boolean }) {
  const { themeId, setThemeId } = useReaganTheme();
  const [openFlyout, setOpenFlyout] = useState(false);
  const active = THEMES[themeId];

  if (collapsed) {
    return (
      <div className="relative flex justify-center">
        <button
          type="button"
          title={`Theme: ${active?.label ?? ""} — tap to change`}
          aria-label="Change theme"
          onClick={() => setOpenFlyout((v) => !v)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 border-white/30 shadow"
          style={{ background: active?.swatch ?? "#444" }}
        >
          🎨
        </button>
        {openFlyout && (
          <div
            className="absolute bottom-11 left-1/2 -translate-x-1/2 z-50 w-44 rounded-xl border bg-popover text-popover-foreground shadow-xl p-1.5 space-y-0.5"
            onMouseLeave={() => setOpenFlyout(false)}
          >
            {THEME_ORDER.map((id) => (
              <ThemeRow key={id} id={id} active={id === themeId} onPick={() => { setThemeId(id); setOpenFlyout(false); }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="px-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
        🎨 <span>Theme</span>
      </div>
      <div className="space-y-0.5">
        {THEME_ORDER.map((id) => (
          <ThemeRow key={id} id={id} active={id === themeId} onPick={() => setThemeId(id)} />
        ))}
      </div>
    </div>
  );
}

function ThemeRow({ id, active, onPick }: { id: ThemeId; active: boolean; onPick: () => void }) {
  const t = THEMES[id];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition ${
        active ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "hover:bg-sidebar-accent text-sidebar-foreground"
      }`}
    >
      <span
        className="w-4 h-4 rounded-full shrink-0 border border-white/40"
        style={{ background: t.swatch }}
        aria-hidden
      />
      <span className="flex-1 text-left truncate">{t.label}</span>
      {active && <span className="text-[10px]">✓</span>}
    </button>
  );
}
