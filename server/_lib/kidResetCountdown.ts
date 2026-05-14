/**
 * Push 122 (2026-05-13) — Kid-facing 5-minute reset countdown.
 *
 * Pure module. When Reagan asks Kiwi for a reset (or when Kiwi
 * suggests one after detecting yellow-zone behavior), the dashboard
 * starts a quiet 5-minute breather. This helper computes the visible
 * state of that countdown deterministically from (startedAtMs, nowMs)
 * so the UI doesn't have to manage its own time math and so the same
 * state can be shown on every device Reagan opens.
 *
 * Why a helper instead of a hook:
 *   - The same countdown might also be shown to Mom on the parent
 *     view ("Reagan is on a reset until 9:42") without re-deriving.
 *   - Vitest can lock the rendering against off-by-one bugs near the
 *     0-second and full-duration boundaries.
 *
 * Key product rules:
 *   - Default duration is 5 min (300_000 ms). Caller may override.
 *   - Negative startedAtMs, non-finite values, and zero-duration
 *     requests collapse to "idle" (no countdown active).
 *   - Once elapsed >= duration, state flips to "finished" and stays
 *     there; the UI shouldn't auto-reset to idle (Reagan needs to
 *     tap "I'm back" so we know she actually re-engaged).
 *   - Kiwi copy is canonical: "Take a beat" → mid → "Welcome back".
 */

export const KID_RESET_DEFAULT_MS = 5 * 60 * 1000;

export type KidResetPhase = "idle" | "running" | "finished";

export interface KidResetVisibleState {
  phase: KidResetPhase;
  /** ms since start; 0 when idle, capped at duration when finished. */
  elapsedMs: number;
  /** ms remaining; 0 when idle or finished. */
  remainingMs: number;
  /** Always returned for UI display; mm:ss form. */
  remainingLabel: string;
  /** 0..1 progress fraction (0 idle, 1 finished). */
  progress: number;
  /** Kid-safe copy from Kiwi for the current phase. */
  kiwiCopy: string;
  /** Adult-tier copy (for Mom's parent-view chip). */
  adultCopy: string;
}

export interface KidResetInput {
  /** UNIX ms when Reagan tapped "start a reset"; null = idle. */
  startedAtMs: number | null | undefined;
  /** Current time in UNIX ms (injected for determinism). */
  nowMs: number;
  /** Optional override for total duration. */
  durationMs?: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function mmss(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

/**
 * Compute the visible reset-countdown state for the given inputs.
 *
 * Idle when:
 *   - startedAtMs is null/undefined, non-finite, or in the future
 *   - durationMs is non-positive or non-finite
 */
export function computeKidResetState(
  input: KidResetInput,
): KidResetVisibleState {
  const duration =
    Number.isFinite(input.durationMs) && (input.durationMs as number) > 0
      ? Math.floor(input.durationMs as number)
      : KID_RESET_DEFAULT_MS;

  const idle: KidResetVisibleState = {
    phase: "idle",
    elapsedMs: 0,
    remainingMs: 0,
    remainingLabel: mmss(0),
    progress: 0,
    kiwiCopy: "Tap 'reset' if you want a quiet 5 min.",
    adultCopy: "No reset active.",
  };

  if (
    input.startedAtMs == null ||
    !Number.isFinite(input.startedAtMs) ||
    !Number.isFinite(input.nowMs)
  ) {
    return idle;
  }
  if (input.startedAtMs > input.nowMs) {
    // Future start — treat as idle (UI shouldn't show a stale ticker).
    return idle;
  }

  const elapsedRaw = input.nowMs - input.startedAtMs;
  if (elapsedRaw < 0) return idle;

  if (elapsedRaw >= duration) {
    return {
      phase: "finished",
      elapsedMs: duration,
      remainingMs: 0,
      remainingLabel: mmss(0),
      progress: 1,
      kiwiCopy: "Welcome back. Tap 'I'm back' when you're ready.",
      adultCopy: "Reset finished — waiting on Reagan to tap back in.",
    };
  }

  // Running — pick mid copy after the 60% mark so the first chunk feels calm.
  const remaining = duration - elapsedRaw;
  const progress = elapsedRaw / duration;
  const mid = progress >= 0.6;

  return {
    phase: "running",
    elapsedMs: elapsedRaw,
    remainingMs: remaining,
    remainingLabel: mmss(remaining),
    progress,
    kiwiCopy: mid
      ? "Almost there. Slow breaths."
      : "Take a beat. I'll keep watch.",
    adultCopy: `Reset in progress — ${mmss(remaining)} left.`,
  };
}
