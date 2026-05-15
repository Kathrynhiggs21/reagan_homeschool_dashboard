/**
 * Wave-15 / Push 263 — kiwiSessionDecay
 *
 * Pure helper that gently decays stale per-panel drift streaks
 * based on elapsed time since each panel's last event.
 *
 * Why this exists: the blessed-line fallback fires when a panel
 * accumulates 2 major events in a row. Without decay, a single
 * drift from yesterday morning + one this afternoon would
 * trigger the fallback unfairly even though there's been no
 * meaningful continuity. We decay each panel's streak toward 0
 * after a quiet period so only genuinely-clustered drifts fire
 * the fallback.
 *
 * Decay rule (deterministic):
 *   • Quiet < 30 min   → no decay
 *   • Quiet 30 min     → streak -1 (floor at 0)
 *   • Quiet ≥ 6 hours  → streak = 0 (full reset)
 *   • In between       → -1 per 30 min, capped to streak size
 *
 * Rotation counters are NOT decayed — they're a "which blessed
 * line next" rotation, not a behavioral signal.
 *
 * Pure: no I/O, no clock. nowUtcMs is a parameter.
 */

import {
  makeKiwiChatSessionState,
  type KiwiChatSessionState,
} from "./kiwiChatSessionState";

const MIN_QUIET_MS = 30 * 60 * 1000; // 30 minutes
const FULL_RESET_MS = 6 * 60 * 60 * 1000; // 6 hours

function clonePlain(
  state: KiwiChatSessionState | null | undefined,
): KiwiChatSessionState {
  if (!state || typeof state !== "object") return makeKiwiChatSessionState();
  return {
    streak: {
      streakByPanel: { ...(state.streak?.streakByPanel ?? {}) },
      lastEventAtUtcMs: { ...(state.streak?.lastEventAtUtcMs ?? {}) },
    },
    rotation: {
      counterByPanel: { ...(state.rotation?.counterByPanel ?? {}) },
    },
  };
}

export interface KiwiSessionDecayResult {
  state: KiwiChatSessionState;
  decayedPanels: string[];
}

export function decayKiwiSessionState(
  state: KiwiChatSessionState | null | undefined,
  nowUtcMs: number,
): KiwiSessionDecayResult {
  const cloned = clonePlain(state);
  if (!Number.isFinite(nowUtcMs) || nowUtcMs < 0) {
    return { state: cloned, decayedPanels: [] };
  }
  const decayedPanels: string[] = [];

  for (const [panel, raw] of Object.entries(cloned.streak.streakByPanel)) {
    const streak = Math.max(0, Math.floor(raw));
    if (streak <= 0) continue;
    const last = cloned.streak.lastEventAtUtcMs[panel];
    if (typeof last !== "number" || !Number.isFinite(last) || last < 0) {
      // No / bad timestamp → treat as ancient → full reset.
      cloned.streak.streakByPanel[panel] = 0;
      decayedPanels.push(panel);
      continue;
    }
    const quiet = nowUtcMs - last;
    if (quiet < MIN_QUIET_MS) continue;
    if (quiet >= FULL_RESET_MS) {
      cloned.streak.streakByPanel[panel] = 0;
      decayedPanels.push(panel);
      continue;
    }
    const decayedBy = Math.floor(quiet / MIN_QUIET_MS);
    const next = Math.max(0, streak - decayedBy);
    if (next !== streak) {
      cloned.streak.streakByPanel[panel] = next;
      decayedPanels.push(panel);
    }
  }

  return { state: cloned, decayedPanels };
}
