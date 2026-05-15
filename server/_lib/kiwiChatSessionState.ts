/**
 * Wave-15 / Push 255 — kiwiChatSessionState
 *
 * Unified state shape that bundles the drift-streak state (Push
 * 249) and the blessed-line rotation-counter state (Push 253)
 * into a single serializable object. The chat UI keeps one
 * localStorage key instead of two.
 *
 * This helper is just a typed wrapper around the two existing
 * stateless update functions. It does NOT introduce any new
 * server-side memory — the client still sends and receives the
 * full state per round-trip.
 *
 * Pure: all functions return new state, never mutate inputs.
 */

import {
  makeKiwiDriftStreakState,
  applyKiwiDriftEvent,
  type KiwiDriftStreakState,
  type KiwiDriftEvent,
} from "./kiwiDriftStreakTracker";
import {
  makeKiwiRotationCounterState,
  advanceKiwiRotationCounter,
  type KiwiRotationCounterState,
} from "./kiwiBlessedLineRotationCounter";

export interface KiwiChatSessionState {
  streak: KiwiDriftStreakState;
  rotation: KiwiRotationCounterState;
}

export function makeKiwiChatSessionState(): KiwiChatSessionState {
  return {
    streak: makeKiwiDriftStreakState(),
    rotation: makeKiwiRotationCounterState(),
  };
}

function clonePlain(
  state: KiwiChatSessionState | null | undefined,
): KiwiChatSessionState {
  if (!state || typeof state !== "object") return makeKiwiChatSessionState();
  return {
    streak:
      state.streak && typeof state.streak === "object"
        ? {
            streakByPanel: { ...(state.streak.streakByPanel ?? {}) },
            lastEventAtUtcMs: { ...(state.streak.lastEventAtUtcMs ?? {}) },
          }
        : makeKiwiDriftStreakState(),
    rotation:
      state.rotation && typeof state.rotation === "object"
        ? {
            counterByPanel: { ...(state.rotation.counterByPanel ?? {}) },
          }
        : makeKiwiRotationCounterState(),
  };
}

/**
 * Apply a drift event to the bundle and (only when the event
 * caused a blessed fallback to fire) also advance the rotation
 * counter for that panel. Returns the new bundle plus the
 * relevant flags so the UI can pass them into the orchestrator.
 */
export function applyKiwiChatSessionEvent(
  prev: KiwiChatSessionState | null | undefined,
  event: KiwiDriftEvent,
): {
  state: KiwiChatSessionState;
  shouldUseBlessedFallback: boolean;
  /** rotation seed AFTER any advance; UI feeds this into the orchestrator. */
  rotationSeedForBlessedPick: number;
} {
  const base = clonePlain(prev);
  const streakResult = applyKiwiDriftEvent(base.streak, event);
  const out: KiwiChatSessionState = {
    streak: streakResult.state,
    rotation: base.rotation,
  };
  let rotationSeedForBlessedPick = 0;
  if (streakResult.shouldUseBlessedFallback) {
    const advanced = advanceKiwiRotationCounter(base.rotation, event.panel);
    out.rotation = advanced.state;
    rotationSeedForBlessedPick = advanced.nextSeed;
  }
  return {
    state: out,
    shouldUseBlessedFallback: streakResult.shouldUseBlessedFallback,
    rotationSeedForBlessedPick,
  };
}

/**
 * Convenience: read the current rotation seed for a panel
 * without advancing it. Useful when the UI just wants the
 * "what would the next blessed pick be" value for a preview.
 */
export function peekKiwiChatSessionSeed(
  state: KiwiChatSessionState | null | undefined,
  panel: string,
): number {
  const cloned = clonePlain(state);
  const key = (panel ?? "today").trim().toLowerCase() || "today";
  return cloned.rotation.counterByPanel[key] ?? 0;
}
