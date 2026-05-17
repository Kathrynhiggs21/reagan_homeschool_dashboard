/**
 * LifecycleChip
 *
 * A small, kid-friendly chip that renders an assignment's lifecycle
 * state as a colored pill plus a primary "next-step" button. Tapping
 * the pill opens a dropdown to jump to any other state.
 *
 * Designed to be drop-in on:
 *   - Today (assignment cards)
 *   - Schedule (block detail rows)
 *   - Classes (lifecycle column items)
 *
 * The component is "headless" w.r.t. data fetching: it just calls
 * `onChange(target)` and lets the parent decide whether to invalidate
 * tRPC queries, optimistically update, or queue a Drive move. This
 * keeps the same chip reusable across pages with very different
 * caching strategies.
 */
import * as React from "react";
import {
  ClassroomLifecycle,
  LIFECYCLE_META,
  LIFECYCLE_ORDER,
  nextLabelFor,
  nextLifecycleStep,
  pickPrimaryTarget,
} from "../../../shared/classroomLifecycleUI";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tone = "slate" | "amber" | "sky" | "emerald";

const TONE_PILL: Record<Tone, string> = {
  // Backgrounds tuned for the dark "Starry Chalkboard" theme but still
  // legible on the lighter Cream Homeschool / Notebook Doodle themes
  // because we lean on opacity + saturated text colors.
  slate: "bg-slate-500/15 text-slate-200 border-slate-400/40",
  amber: "bg-amber-500/20 text-amber-200 border-amber-400/50",
  sky: "bg-sky-500/20 text-sky-200 border-sky-400/50",
  emerald: "bg-emerald-500/20 text-emerald-200 border-emerald-400/50",
};

const TONE_BUTTON: Record<Tone, string> = {
  slate: "hover:bg-slate-500/20",
  amber: "hover:bg-amber-500/25",
  sky: "hover:bg-sky-500/25",
  emerald: "hover:bg-emerald-500/25",
};

export type LifecycleChipProps = {
  /** Current lifecycle state of the assignment. */
  status: ClassroomLifecycle;
  /** Called when the user picks a target state (any non-current state). */
  onChange: (target: ClassroomLifecycle) => void;
  /** Disable interaction (e.g. mid-mutation). */
  disabled?: boolean;
  /** Compact variant trims the action label to just the emoji. */
  compact?: boolean;
  /**
   * Optional id used by tests / aria-label so each chip on a list page
   * can be located unambiguously. Defaults to the status string.
   */
  testId?: string;
};

export function LifecycleChip({
  status,
  onChange,
  disabled = false,
  compact = false,
  testId,
}: LifecycleChipProps) {
  const meta = LIFECYCLE_META[status];
  const next = nextLifecycleStep(status);
  const tone = meta.tone as Tone;

  const handlePrimary = () => {
    if (disabled) return;
    onChange(pickPrimaryTarget(status));
  };

  return (
    <div
      className="inline-flex items-stretch gap-0 rounded-full border overflow-hidden"
      data-testid={testId ?? `lifecycle-chip-${status}`}
      data-status={status}
    >
      {/* Status pill — also doubles as the "more states" trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Status: ${meta.label}. Open to change.`}
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium",
              TONE_PILL[tone],
              "transition-colors",
              disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            <span aria-hidden>{meta.emoji}</span>
            <span>{meta.label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {LIFECYCLE_ORDER.filter((s) => s !== status).map((target) => (
            <DropdownMenuItem
              key={target}
              onClick={() => !disabled && onChange(target)}
              disabled={disabled}
            >
              <span aria-hidden className="mr-2">
                {LIFECYCLE_META[target].emoji}
              </span>
              {nextLabelFor(status, target)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Primary "next-step" button — forward step when one exists, else
          "Reopen" for the terminal graded state. */}
      <button
        type="button"
        onClick={handlePrimary}
        disabled={disabled}
        aria-label={
          next
            ? `Move from ${meta.label} to ${LIFECYCLE_META[next].label}`
            : `Reopen ${meta.label} assignment`
        }
        className={[
          "inline-flex items-center px-2.5 py-1 text-xs font-medium border-l",
          // Use the *next* state's tone if there is one, so the button
          // visually previews where it's about to go.
          next
            ? TONE_PILL[LIFECYCLE_META[next].tone as Tone].replace(
                "border",
                "",
              )
            : TONE_PILL.slate,
          TONE_BUTTON[(next ? LIFECYCLE_META[next].tone : "slate") as Tone],
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
          "transition-colors",
        ].join(" ")}
      >
        {compact
          ? next
            ? LIFECYCLE_META[next].emoji
            : "↺"
          : nextLabelFor(status, next ?? "to_do")}
      </button>
    </div>
  );
}
