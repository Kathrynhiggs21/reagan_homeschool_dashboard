/**
 * shared/classroomLifecycleUI
 *
 * Single source of truth for lifecycle UI strings/colors so the same
 * chip looks identical on Today, Schedule, and Classes. Lives in
 * `shared/` because both the React app and the server-side default
 * exporter (recap emails, weekly digests) read these.
 *
 * No imports beyond the type alias — keeps it pure & vitest-friendly.
 */

export type ClassroomLifecycle =
  | "to_do"
  | "in_progress"
  | "turned_in"
  | "graded";

export const LIFECYCLE_ORDER: ClassroomLifecycle[] = [
  "to_do",
  "in_progress",
  "turned_in",
  "graded",
];

export type LifecycleChipMeta = {
  label: string;
  /** Short verb the kid sees on the next-step button: e.g. "Start it!" */
  nextActionLabel: string;
  /** Tailwind/css token name; UI maps these to actual classes. */
  tone: "slate" | "amber" | "sky" | "emerald";
  /** Tiny inline emoji for the chip — Reagan-readable. */
  emoji: string;
};

export const LIFECYCLE_META: Record<ClassroomLifecycle, LifecycleChipMeta> = {
  to_do: {
    label: "To Do",
    nextActionLabel: "Start it!",
    tone: "slate",
    emoji: "📝",
  },
  in_progress: {
    label: "Working",
    nextActionLabel: "Turn it in",
    tone: "amber",
    emoji: "✏️",
  },
  turned_in: {
    label: "Turned In",
    nextActionLabel: "Mark graded",
    tone: "sky",
    emoji: "📤",
  },
  graded: {
    label: "Graded",
    nextActionLabel: "Reopen",
    tone: "emerald",
    emoji: "⭐",
  },
};

/**
 * Given a current lifecycle state, return the next state in the canonical
 * forward chain — or null if there is no forward step (i.e. graded is
 * terminal). UI uses this for the primary "next-step" button.
 */
export function nextLifecycleStep(
  current: ClassroomLifecycle,
): ClassroomLifecycle | null {
  const idx = LIFECYCLE_ORDER.indexOf(current);
  if (idx < 0) return null;
  if (idx === LIFECYCLE_ORDER.length - 1) return null;
  return LIFECYCLE_ORDER[idx + 1];
}

/**
 * For the secondary "More" picker — return every OTHER state the chip can
 * jump to (excluding current and the next-step that already has its own
 * primary button). Order is canonical so the picker is stable.
 */
export function otherLifecycleSteps(
  current: ClassroomLifecycle,
): ClassroomLifecycle[] {
  const next = nextLifecycleStep(current);
  return LIFECYCLE_ORDER.filter((s) => s !== current && s !== next);
}

/**
 * Decide which lifecycle target the chip's primary (next-step) button
 * should fire when tapped. Forward step if one exists; otherwise (graded
 * is terminal) the canonical reopen target is "to_do". Pure so the chip
 * component, the Today block, and the Schedule block can all share the
 * exact same rule without re-implementing it.
 */
export function pickPrimaryTarget(
  current: ClassroomLifecycle,
): ClassroomLifecycle {
  return nextLifecycleStep(current) ?? "to_do";
}

/**
 * Compose the kid-facing action label for a (current → target) move,
 * e.g. nextLabelFor("to_do", "in_progress") → "Start it!".
 * For non-canonical jumps (e.g. to_do → graded) we fall back to
 * "Move to {label}" so the chip still reads naturally.
 */
export function nextLabelFor(
  current: ClassroomLifecycle,
  target: ClassroomLifecycle,
): string {
  const next = nextLifecycleStep(current);
  const meta = LIFECYCLE_META[current];
  if (target === next) return meta.nextActionLabel;
  // Backward = "Reopen to {label}". Forward-skip = "Jump to {label}".
  const currentIdx = LIFECYCLE_ORDER.indexOf(current);
  const targetIdx = LIFECYCLE_ORDER.indexOf(target);
  if (targetIdx < currentIdx) return `Reopen to ${LIFECYCLE_META[target].label}`;
  return `Jump to ${LIFECYCLE_META[target].label}`;
}
