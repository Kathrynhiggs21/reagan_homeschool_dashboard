/**
 * Wave-15 / Push 281 — kiwiPanelLastVisitTracker
 *
 * Per-panel last-visited timestamp tracker. The chat UI uses
 * this to decide whether the calm greeting (Push 277) should
 * fire on the current panel mount or stay quiet because Reagan
 * just left and came back within minutes — repeating a greeting
 * three times in five minutes feels chirpy.
 *
 * Rules:
 *   - If never visited → shouldGreet=true; record now.
 *   - If visited within suppressWindowMs → shouldGreet=false.
 *   - If outside the window → shouldGreet=true; record now.
 *
 * Pure: returns NEW state object, never mutates input.
 * Defaults: suppressWindowMs = 10 minutes.
 */

export interface KiwiPanelVisitState {
  panels: Record<string, number>; // panel → utcMs of last greet
}

export interface KiwiPanelVisitInput {
  prior: KiwiPanelVisitState | null | undefined;
  panel: string;
  nowUtcMs: number;
  suppressWindowMs?: number;
}

export interface KiwiPanelVisitResult {
  state: KiwiPanelVisitState;
  shouldGreet: boolean;
  reason: "first_visit" | "outside_window" | "suppressed";
  msSinceLastGreet: number | null;
}

const DEFAULT_SUPPRESS_MS = 10 * 60 * 1000;

function normalizePanel(p: unknown): string {
  return String(p ?? "")
    .trim()
    .toLowerCase() || "today";
}

function sanitizePrior(
  prior: KiwiPanelVisitState | null | undefined,
): KiwiPanelVisitState {
  if (!prior || typeof prior !== "object") return { panels: {} };
  const src = prior.panels;
  if (!src || typeof src !== "object") return { panels: {} };
  const out: Record<string, number> = {};
  for (const key of Object.keys(src)) {
    const v = (src as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      const norm = normalizePanel(key);
      // Keep latest if duplicates after lowercasing
      if (out[norm] === undefined || v > out[norm]) {
        out[norm] = v;
      }
    }
  }
  return { panels: out };
}

export function applyKiwiPanelVisit(
  input: KiwiPanelVisitInput,
): KiwiPanelVisitResult {
  const state = sanitizePrior(input.prior);
  const panel = normalizePanel(input.panel);
  const now =
    Number.isFinite(input.nowUtcMs) && input.nowUtcMs >= 0
      ? Math.floor(input.nowUtcMs)
      : 0;
  const windowRaw =
    typeof input.suppressWindowMs === "number" &&
    Number.isFinite(input.suppressWindowMs) &&
    input.suppressWindowMs > 0
      ? Math.floor(input.suppressWindowMs)
      : DEFAULT_SUPPRESS_MS;

  const last = state.panels[panel];
  if (last === undefined) {
    return {
      state: { panels: { ...state.panels, [panel]: now } },
      shouldGreet: true,
      reason: "first_visit",
      msSinceLastGreet: null,
    };
  }
  const elapsed = now - last;
  // Negative elapsed (clock skew back) → treat as outside window.
  if (elapsed < 0 || elapsed >= windowRaw) {
    return {
      state: { panels: { ...state.panels, [panel]: now } },
      shouldGreet: true,
      reason: "outside_window",
      msSinceLastGreet: elapsed < 0 ? null : elapsed,
    };
  }
  return {
    state, // unchanged
    shouldGreet: false,
    reason: "suppressed",
    msSinceLastGreet: elapsed,
  };
}
