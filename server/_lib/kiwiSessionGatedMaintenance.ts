/**
 * Wave-15 / Push 275 — kiwiSessionGatedMaintenance
 *
 * Composes the cadence gate (Push 273) with the maintenance
 * bundle (Push 271) into a single helper. The chat UI gets
 * one call that:
 *
 *   • consults the gate first
 *   • if gate says "skip", returns { ranMaintenance: false }
 *     along with the schedule diagnostics (next eligible)
 *   • if gate says "run", executes the maintenance pass and
 *     returns the resulting state, trimmed panels, audit, and
 *     re-export string
 *
 * Pure: no I/O, no clock — nowUtcMs is a parameter.
 */

import {
  decideKiwiMaintenance,
  type KiwiMaintenanceScheduleResult,
} from "./kiwiSessionMaintenanceScheduler";
import {
  runKiwiSessionMaintenance,
  type KiwiSessionMaintenanceResult,
  type KiwiSessionMaintenanceOptions,
} from "./kiwiSessionMaintenanceBundle";
import type { KiwiChatSessionState } from "./kiwiChatSessionState";

export interface KiwiGatedMaintenanceInput {
  priorState: KiwiChatSessionState | null | undefined;
  nowUtcMs: number;
  lastMaintenanceAtUtcMs?: number | null;
  cooldownMs?: number;
  purgeOlderThanMs?: number;
  considerTrimBytes?: number;
  trimNowBytes?: number;
}

export interface KiwiGatedMaintenanceResult {
  schedule: KiwiMaintenanceScheduleResult;
  ranMaintenance: boolean;
  maintenance: KiwiSessionMaintenanceResult | null;
}

export function runKiwiGatedMaintenance(
  input: KiwiGatedMaintenanceInput,
): KiwiGatedMaintenanceResult {
  const schedule = decideKiwiMaintenance({
    lastMaintenanceAtUtcMs: input.lastMaintenanceAtUtcMs,
    nowUtcMs: input.nowUtcMs,
    cooldownMs: input.cooldownMs,
  });
  if (schedule.decision === "skip") {
    return { schedule, ranMaintenance: false, maintenance: null };
  }
  const options: KiwiSessionMaintenanceOptions = {
    purgeOlderThanMs: input.purgeOlderThanMs,
    considerTrimBytes: input.considerTrimBytes,
    trimNowBytes: input.trimNowBytes,
  };
  const maintenance = runKiwiSessionMaintenance(
    input.priorState,
    input.nowUtcMs,
    options,
  );
  return { schedule, ranMaintenance: true, maintenance };
}
