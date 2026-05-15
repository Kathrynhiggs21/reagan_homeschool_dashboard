/**
 * Wave-15 / Push 253 — kiwiBlessedLineRotationCounter
 *
 * Pure helper that advances a per-panel rotation counter. The UI
 * passes this counter into kiwiReplyOrchestrate's rotationSeed
 * input. Each time a blessed-line fallback actually fires for a
 * panel, the UI calls advanceKiwiRotationCounter for that panel to
 * bump the seed so the next blessed pick isn't the same line.
 *
 * State is a plain serializable record so the client can keep it
 * in localStorage alongside the streak state. Server holds no
 * per-session memory.
 *
 * Defensive normalization mirrors kiwiDriftStreakTracker:
 * non-finite → 0, negative → 0, panel coerced to lowercase, empty
 * panel → "today".
 */

export interface KiwiRotationCounterState {
  counterByPanel: Record<string, number>;
}

export function makeKiwiRotationCounterState(): KiwiRotationCounterState {
  return { counterByPanel: {} };
}

function normalizePanel(panel: string | null | undefined): string {
  if (typeof panel !== "string") return "today";
  const t = panel.trim().toLowerCase();
  return t.length === 0 ? "today" : t;
}

function clonePlain(
  state: KiwiRotationCounterState | null | undefined,
): KiwiRotationCounterState {
  if (!state || typeof state !== "object") return makeKiwiRotationCounterState();
  const out: Record<string, number> = {};
  if (state.counterByPanel && typeof state.counterByPanel === "object") {
    for (const [k, v] of Object.entries(state.counterByPanel)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[k] = Math.floor(v);
      }
    }
  }
  return { counterByPanel: out };
}

export function readKiwiRotationCounter(
  state: KiwiRotationCounterState | null | undefined,
  panel: string,
): number {
  const cloned = clonePlain(state);
  return cloned.counterByPanel[normalizePanel(panel)] ?? 0;
}

export function advanceKiwiRotationCounter(
  prev: KiwiRotationCounterState | null | undefined,
  panel: string,
): { state: KiwiRotationCounterState; nextSeed: number } {
  const state = clonePlain(prev);
  const key = normalizePanel(panel);
  const current = state.counterByPanel[key] ?? 0;
  const next = current + 1;
  state.counterByPanel[key] = next;
  return { state, nextSeed: next };
}

export function resetKiwiRotationCounter(
  prev: KiwiRotationCounterState | null | undefined,
  panel: string,
): KiwiRotationCounterState {
  const state = clonePlain(prev);
  state.counterByPanel[normalizePanel(panel)] = 0;
  return state;
}
