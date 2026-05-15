/**
 * Wave-15 / Push 249 — kiwiDriftStreakTracker
 *
 * Pure deterministic state-machine helper. Tracks consecutive
 * drift-flagged events per panel. When a panel reaches a streak of
 * 2 or more, the UI is told to stop trying to regenerate and switch
 * to the blessed-line fallback from Push 247.
 *
 * Any clean event (severity !== "major") resets that panel's streak
 * to zero. Major events ONLY count for the panel they occurred on
 * (panel A's streak does not affect panel B).
 *
 * The state is intentionally a plain serializable record so callers
 * can keep it in localStorage / a tRPC query cache / a DB row —
 * this helper is the pure update function, not a stateful class.
 *
 * Adult-tone copy rules enforced in vitests:
 *  - "fallback reason" string carries no exclamation marks
 *  - No emotional language ("alarming", "worrying", "bad")
 *  - No mention of Reagan by name
 */

export interface KiwiDriftStreakState {
  /** Map of panel id → current consecutive major-severity streak. */
  streakByPanel: Record<string, number>;
  /** Map of panel id → timestamp (UTC ms) of the latest event. */
  lastEventAtUtcMs: Record<string, number>;
}

export type KiwiDriftSeverity = "info" | "minor" | "major";

export interface KiwiDriftEvent {
  panel: string;
  severity: KiwiDriftSeverity;
  timestampUtcMs: number;
}

export interface KiwiDriftStreakUpdate {
  state: KiwiDriftStreakState;
  shouldUseBlessedFallback: boolean;
  /** Streak value for the panel after this event was applied. */
  currentStreak: number;
  /**
   * Adult-tone reason string when blessed fallback should fire.
   * Empty string otherwise. Safe to display in adult review UI.
   */
  fallbackReason: string;
}

const THRESHOLD = 2;

/**
 * Build an empty initial state. Useful for first-run callers.
 */
export function makeKiwiDriftStreakState(): KiwiDriftStreakState {
  return { streakByPanel: {}, lastEventAtUtcMs: {} };
}

function clonePlain(state: KiwiDriftStreakState | null | undefined): KiwiDriftStreakState {
  if (!state || typeof state !== "object") return makeKiwiDriftStreakState();
  const streakByPanel: Record<string, number> = {};
  const lastEventAtUtcMs: Record<string, number> = {};
  if (state.streakByPanel && typeof state.streakByPanel === "object") {
    for (const [k, v] of Object.entries(state.streakByPanel)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        streakByPanel[k] = Math.floor(v);
      }
    }
  }
  if (state.lastEventAtUtcMs && typeof state.lastEventAtUtcMs === "object") {
    for (const [k, v] of Object.entries(state.lastEventAtUtcMs)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        lastEventAtUtcMs[k] = Math.floor(v);
      }
    }
  }
  return { streakByPanel, lastEventAtUtcMs };
}

function normalizePanel(panel: string | null | undefined): string {
  if (typeof panel !== "string") return "today";
  const trimmed = panel.trim().toLowerCase();
  return trimmed.length === 0 ? "today" : trimmed;
}

/**
 * Apply a single drift event to the streak state and return the new
 * state + whether the UI should switch to the blessed fallback.
 *
 * Pure: the input state is never mutated.
 */
export function applyKiwiDriftEvent(
  prev: KiwiDriftStreakState | null | undefined,
  event: KiwiDriftEvent,
): KiwiDriftStreakUpdate {
  const state = clonePlain(prev);
  const panel = normalizePanel(event.panel);
  const ts =
    Number.isFinite(event.timestampUtcMs) && event.timestampUtcMs >= 0
      ? Math.floor(event.timestampUtcMs)
      : 0;
  if (event.severity === "major") {
    const next = (state.streakByPanel[panel] ?? 0) + 1;
    state.streakByPanel[panel] = next;
  } else {
    // Any non-major event resets the panel's streak.
    state.streakByPanel[panel] = 0;
  }
  state.lastEventAtUtcMs[panel] = ts;
  const currentStreak = state.streakByPanel[panel] ?? 0;
  const shouldUseBlessedFallback = currentStreak >= THRESHOLD;
  const fallbackReason = shouldUseBlessedFallback
    ? `Two drift fallbacks in a row on the ${panel} panel. Showing a blessed line instead.`
    : "";
  return {
    state,
    shouldUseBlessedFallback,
    currentStreak,
    fallbackReason,
  };
}

/**
 * Inspect the current streak for a panel without modifying state.
 */
export function readKiwiDriftStreak(
  state: KiwiDriftStreakState | null | undefined,
  panel: string,
): number {
  const cloned = clonePlain(state);
  return cloned.streakByPanel[normalizePanel(panel)] ?? 0;
}

/** Reset just one panel's streak. Useful when the user closes the chat. */
export function resetKiwiDriftStreak(
  prev: KiwiDriftStreakState | null | undefined,
  panel: string,
): KiwiDriftStreakState {
  const state = clonePlain(prev);
  state.streakByPanel[normalizePanel(panel)] = 0;
  return state;
}
