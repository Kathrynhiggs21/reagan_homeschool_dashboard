/**
 * Wave-15 / Push 273 — kiwiSessionMaintenanceScheduler
 *
 * Pure helper that decides whether maintenance should run on
 * this call. The chat UI calls this BEFORE the maintenance
 * bundle (Push 271) so it doesn't spam trim+audit on every
 * clean reply.
 *
 * Decision rules (first match wins):
 *   • lastMaintenanceAtUtcMs missing/invalid → "run" (first run)
 *   • nowUtcMs invalid → "skip" (clock not trustworthy)
 *   • elapsed since last run < cooldown → "skip"
 *   • otherwise → "run"
 *
 * Default cooldown: 5 minutes. Tunable via input.
 *
 * Pure: no I/O, no clock.
 */

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

export type KiwiMaintenanceDecision = "run" | "skip";

export interface KiwiMaintenanceScheduleResult {
  decision: KiwiMaintenanceDecision;
  reason: string;
  nextEligibleAtUtcMs: number | null;
}

export interface KiwiMaintenanceScheduleInput {
  lastMaintenanceAtUtcMs?: number | null;
  nowUtcMs: number;
  cooldownMs?: number;
}

export function decideKiwiMaintenance(
  input: KiwiMaintenanceScheduleInput,
): KiwiMaintenanceScheduleResult {
  const cooldown =
    typeof input.cooldownMs === "number" &&
    Number.isFinite(input.cooldownMs) &&
    input.cooldownMs >= 0
      ? input.cooldownMs
      : DEFAULT_COOLDOWN_MS;
  if (!Number.isFinite(input.nowUtcMs) || input.nowUtcMs < 0) {
    return {
      decision: "skip",
      reason: "now timestamp is not finite",
      nextEligibleAtUtcMs: null,
    };
  }
  const last = input.lastMaintenanceAtUtcMs;
  if (last === undefined || last === null || !Number.isFinite(last)) {
    return {
      decision: "run",
      reason: "first run",
      nextEligibleAtUtcMs: input.nowUtcMs + cooldown,
    };
  }
  const elapsed = input.nowUtcMs - last;
  if (elapsed < cooldown) {
    return {
      decision: "skip",
      reason: "cooldown not elapsed",
      nextEligibleAtUtcMs: last + cooldown,
    };
  }
  return {
    decision: "run",
    reason: "cooldown elapsed",
    nextEligibleAtUtcMs: input.nowUtcMs + cooldown,
  };
}
