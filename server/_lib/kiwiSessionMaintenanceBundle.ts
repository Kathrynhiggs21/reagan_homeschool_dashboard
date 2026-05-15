/**
 * Wave-15 / Push 271 — kiwiSessionMaintenanceBundle
 *
 * Composes the trim helper (Push 267) and size auditor (Push 269)
 * into a single maintenance pass. Given the current state + now,
 * returns the trimmed state, the list of trimmed panels, the size
 * audit of the trimmed state, and the re-export string so the
 * caller can write it back to localStorage atomically.
 *
 * Pure: no I/O, no clock — nowUtcMs is a parameter.
 */

import {
  trimKiwiSessionState,
  type KiwiSessionTrimResult,
} from "./kiwiSessionTrimmer";
import {
  auditKiwiSessionSize,
  type KiwiSessionSizeAuditResult,
  type KiwiSessionSizeAuditOptions,
} from "./kiwiSessionSizeAuditor";
import { exportKiwiSessionState } from "./kiwiSessionExportSerializer";
import type { KiwiChatSessionState } from "./kiwiChatSessionState";

export interface KiwiSessionMaintenanceResult {
  state: KiwiChatSessionState;
  trimmedPanels: string[];
  audit: KiwiSessionSizeAuditResult;
  reExported: string;
}

export interface KiwiSessionMaintenanceOptions {
  purgeOlderThanMs?: number;
  considerTrimBytes?: number;
  trimNowBytes?: number;
}

export function runKiwiSessionMaintenance(
  state: KiwiChatSessionState | null | undefined,
  nowUtcMs: number,
  options: KiwiSessionMaintenanceOptions = {},
): KiwiSessionMaintenanceResult {
  const trim: KiwiSessionTrimResult = trimKiwiSessionState(
    state,
    nowUtcMs,
    options.purgeOlderThanMs,
  );
  const auditOpts: KiwiSessionSizeAuditOptions = {
    considerTrimBytes: options.considerTrimBytes,
    trimNowBytes: options.trimNowBytes,
  };
  const audit = auditKiwiSessionSize(trim.state, auditOpts);
  return {
    state: trim.state,
    trimmedPanels: trim.trimmedPanels,
    audit,
    reExported: exportKiwiSessionState(trim.state),
  };
}
