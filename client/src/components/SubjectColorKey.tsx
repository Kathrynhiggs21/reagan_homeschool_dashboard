/**
 * Subject Color Key — collapsible swatch card.
 * Pinned at top of Today and Curriculum so Reagan + Mom learn the color code.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { COLOR_KEY_SUBJECTS, APP_CATEGORY_KEY, type SubjectTint } from "@/lib/subjectColors";

export default function SubjectColorKey({
  variant = "schedule",
  defaultOpen = false,
}: {
  variant?: "schedule" | "apps";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const items: SubjectTint[] = variant === "apps" ? APP_CATEGORY_KEY : COLOR_KEY_SUBJECTS;
  return (
    <Card className="classroom-card p-3 md:p-4">
      <button
        className="w-full flex items-center justify-between text-sm font-display font-semibold"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">🎨 Color Key</span>
        <span className="text-xs text-muted-foreground">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map((s) => (
            <div
              key={s.slug}
              className="rounded-lg p-2 text-xs flex items-center gap-2"
              style={{ backgroundColor: s.bg, borderLeft: `4px solid ${s.border}`, color: s.ink }}
            >
              <span className="text-base">{s.emoji}</span>
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.label}</div>
                <div className="opacity-75 truncate">{s.meaning}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
