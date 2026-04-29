import { THEMES, useReaganTheme, type ThemeId } from "@/contexts/ReaganThemes";

const ORDER: ThemeId[] = ["starry", "cream", "chalkboard", "notebook"];

export default function ThemePickerStrip({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId } = useReaganTheme();
  return (
    <div
      className="rounded-2xl p-3 flex items-center gap-2 flex-wrap"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.18))",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 4px 0 rgba(0,0,0,0.25)",
      }}
    >
      {!compact && (
        <span className="font-display font-semibold text-sm mr-1 chalk-white">🎨 Theme:</span>
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
              background: active ? "rgba(255,216,106,0.95)" : "rgba(255,255,255,0.06)",
              color: active ? "#3a2a00" : "#f4eedc",
              border: active ? "2px solid #fff" : "2px solid rgba(255,255,255,0.15)",
              boxShadow: active
                ? "0 4px 0 rgba(0,0,0,0.35), 0 0 18px rgba(255,216,106,0.35)"
                : "0 2px 0 rgba(0,0,0,0.25)",
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
