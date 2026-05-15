/**
 * Wave-15 / Push 267 — kiwiSessionTrimmer
 *
 * Pure helper that drops dead-weight per-panel entries from the
 * Kiwi chat session state so the localStorage blob doesn't grow
 * unboundedly over time as Reagan visits different surfaces.
 *
 * An entry is considered dead weight for a panel when ALL of:
 *   • streakByPanel[panel] is missing or 0
 *   • rotation.counterByPanel[panel] is missing or 0
 *   • lastEventAtUtcMs[panel] is missing OR older than the
 *     `purgeOlderThanMs` window (default 30 days)
 *
 * Trimming preserves any panel with a live streak, non-zero
 * rotation counter (so blessed-line rotation continues even
 * across long quiet periods), or a recent timestamp.
 *
 * Pure: no I/O, no clock. nowUtcMs is a parameter.
 */

import {
  makeKiwiChatSessionState,
  type KiwiChatSessionState,
} from "./kiwiChatSessionState";

const DEFAULT_PURGE_OLDER_THAN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface KiwiSessionTrimResult {
  state: KiwiChatSessionState;
  trimmedPanels: string[];
}

export function trimKiwiSessionState(
  state: KiwiChatSessionState | null | undefined,
  nowUtcMs: number,
  purgeOlderThanMs: number = DEFAULT_PURGE_OLDER_THAN_MS,
): KiwiSessionTrimResult {
  if (!state || typeof state !== "object") {
    return { state: makeKiwiChatSessionState(), trimmedPanels: [] };
  }
  const out: KiwiChatSessionState = {
    streak: {
      streakByPanel: { ...(state.streak?.streakByPanel ?? {}) },
      lastEventAtUtcMs: { ...(state.streak?.lastEventAtUtcMs ?? {}) },
    },
    rotation: {
      counterByPanel: { ...(state.rotation?.counterByPanel ?? {}) },
    },
  };
  if (!Number.isFinite(nowUtcMs) || nowUtcMs < 0) {
    return { state: out, trimmedPanels: [] };
  }
  const safeWindow =
    Number.isFinite(purgeOlderThanMs) && purgeOlderThanMs >= 0
      ? purgeOlderThanMs
      : DEFAULT_PURGE_OLDER_THAN_MS;
  const panelSet: Record<string, true> = {};
  for (const k of Object.keys(out.streak.streakByPanel)) panelSet[k] = true;
  for (const k of Object.keys(out.streak.lastEventAtUtcMs)) panelSet[k] = true;
  for (const k of Object.keys(out.rotation.counterByPanel)) panelSet[k] = true;
  const trimmed: string[] = [];
  for (const panel of Object.keys(panelSet)) {
    const streak = out.streak.streakByPanel[panel] ?? 0;
    const rotation = out.rotation.counterByPanel[panel] ?? 0;
    const last = out.streak.lastEventAtUtcMs[panel];
    const hasRecentTimestamp =
      typeof last === "number" &&
      Number.isFinite(last) &&
      nowUtcMs - last <= safeWindow;
    if (streak > 0 || rotation > 0 || hasRecentTimestamp) continue;
    delete out.streak.streakByPanel[panel];
    delete out.streak.lastEventAtUtcMs[panel];
    delete out.rotation.counterByPanel[panel];
    trimmed.push(panel);
  }
  return { state: out, trimmedPanels: trimmed };
}
