/**
 * Wave-15 / Push 283 — kiwiPanelEntryBundle
 *
 * One-call panel mount. Composes:
 *   1. kiwiPanelLastVisitTracker (Push 281)    — should we greet?
 *   2. kiwiClockHelpers (Push 279)             — utc+tz → clock parts
 *   3. kiwiGreetingComposer (Push 277)         — calm greeting
 *
 * Returns the new visit-tracker state + (optionally) the greeting.
 * If shouldGreet is false (suppressed window), greeting is null and
 * no clock derivation runs (cheaper, and importantly: keeps the
 * audit trail clean — no greeting was synthesized).
 *
 * Pure: no I/O, no clock. Caller supplies nowUtcMs + timeZone.
 */

import {
  applyKiwiPanelVisit,
  type KiwiPanelVisitState,
} from "./kiwiPanelLastVisitTracker";
import { deriveKiwiClockParts, type KiwiClockParts } from "./kiwiClockHelpers";
import {
  composeKiwiGreeting,
  type KiwiGreetingResult,
} from "./kiwiGreetingComposer";

export interface KiwiPanelEntryInput {
  prior: KiwiPanelVisitState | null | undefined;
  panel: string;
  nowUtcMs: number;
  timeZone?: string | null;
  suppressWindowMs?: number;
}

export interface KiwiPanelEntryResult {
  state: KiwiPanelVisitState;
  shouldGreet: boolean;
  greeting: KiwiGreetingResult | null;
  clock: KiwiClockParts | null;
  reason: "first_visit" | "outside_window" | "suppressed";
  msSinceLastGreet: number | null;
}

export function runKiwiPanelEntry(
  input: KiwiPanelEntryInput,
): KiwiPanelEntryResult {
  const visit = applyKiwiPanelVisit({
    prior: input.prior,
    panel: input.panel,
    nowUtcMs: input.nowUtcMs,
    suppressWindowMs: input.suppressWindowMs,
  });

  if (!visit.shouldGreet) {
    return {
      state: visit.state,
      shouldGreet: false,
      greeting: null,
      clock: null,
      reason: visit.reason,
      msSinceLastGreet: visit.msSinceLastGreet,
    };
  }

  const clock = deriveKiwiClockParts(input.nowUtcMs, input.timeZone);
  const greeting = composeKiwiGreeting({
    panel: input.panel,
    localHour: clock.localHour,
    dayIndex: clock.dayIndex,
  });

  return {
    state: visit.state,
    shouldGreet: true,
    greeting,
    clock,
    reason: visit.reason,
    msSinceLastGreet: visit.msSinceLastGreet,
  };
}
