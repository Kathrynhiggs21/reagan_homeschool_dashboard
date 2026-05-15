/**
 * Wave-15 / Push 285 — kiwiQuietHoursGate
 *
 * Deterministic quiet-hours gate. Returns whether Kiwi should
 * stay completely silent (no greetings, no proactive messages)
 * during configured late-night hours. Reactive responses to
 * Reagan's direct messages are NEVER gated — this is for
 * proactive surfaces only (panel-mount greetings, drift notices,
 * etc.).
 *
 * Default window: 21:00 – 06:59 local time.
 * Wraps midnight; window expressed as inclusive startHour and
 * EXCLUSIVE endHour (so 21..7 means 21:00 through 06:59).
 *
 * Pure: no I/O, no clock. Inputs only.
 */

export interface KiwiQuietHoursInput {
  localHour: number; // 0..23
  startHour?: number; // inclusive
  endHour?: number; // exclusive
}

export interface KiwiQuietHoursResult {
  isQuiet: boolean;
  windowApplied: { start: number; end: number };
  reason: "in_quiet_window" | "outside_window" | "invalid_input";
}

const DEFAULT_START = 21;
const DEFAULT_END = 7;

function normHour(n: unknown, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < 0 || i > 23) return fallback;
  return i;
}

export function checkKiwiQuietHours(
  input: KiwiQuietHoursInput,
): KiwiQuietHoursResult {
  const start = normHour(input.startHour, DEFAULT_START);
  const end = normHour(input.endHour, DEFAULT_END);
  const window = { start, end };

  // If start === end the window is empty (never quiet).
  if (start === end) {
    return { isQuiet: false, windowApplied: window, reason: "outside_window" };
  }

  if (
    typeof input.localHour !== "number" ||
    !Number.isFinite(input.localHour) ||
    input.localHour < 0 ||
    input.localHour > 23
  ) {
    // Invalid hour → fail-safe to NOT quiet (never block reactive use cases).
    return { isQuiet: false, windowApplied: window, reason: "invalid_input" };
  }
  const h = Math.floor(input.localHour);

  let inWindow: boolean;
  if (start < end) {
    // Non-wrapping: e.g., 1..5 means 01:00..04:59
    inWindow = h >= start && h < end;
  } else {
    // Wrapping past midnight: e.g., 21..7 means 21:00..06:59
    inWindow = h >= start || h < end;
  }

  return {
    isQuiet: inWindow,
    windowApplied: window,
    reason: inWindow ? "in_quiet_window" : "outside_window",
  };
}
