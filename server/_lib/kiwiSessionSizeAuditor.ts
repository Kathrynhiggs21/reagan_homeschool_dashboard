/**
 * Wave-15 / Push 269 — kiwiSessionSizeAuditor
 *
 * Diagnostic helper for the adult review page. Given the Kiwi
 * chat session state, returns:
 *   • totalPanels: union of panels seen across streak + rotation
 *   • livePanels: panels with streak>0 OR rotation>0
 *   • encodedByteCount: byte length of the serialized envelope
 *   • recommendation: "ok" | "consider_trim" | "trim_now"
 *
 * Thresholds (tunable via the auditor input):
 *   • encodedByteCount ≥ 8 KB → "trim_now"
 *   • encodedByteCount ≥ 2 KB → "consider_trim"
 *   • otherwise              → "ok"
 *
 * Pure: no I/O, no clock.
 */

import {
  makeKiwiChatSessionState,
  type KiwiChatSessionState,
} from "./kiwiChatSessionState";
import { exportKiwiSessionState } from "./kiwiSessionExportSerializer";

export interface KiwiSessionSizeAuditResult {
  totalPanels: number;
  livePanels: number;
  encodedByteCount: number;
  recommendation: "ok" | "consider_trim" | "trim_now";
}

export interface KiwiSessionSizeAuditOptions {
  considerTrimBytes?: number;
  trimNowBytes?: number;
}

function byteLengthUtf8(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

export function auditKiwiSessionSize(
  state: KiwiChatSessionState | null | undefined,
  options: KiwiSessionSizeAuditOptions = {},
): KiwiSessionSizeAuditResult {
  const safe = state ?? makeKiwiChatSessionState();
  const streakKeys = Object.keys(safe.streak?.streakByPanel ?? {});
  const lastKeys = Object.keys(safe.streak?.lastEventAtUtcMs ?? {});
  const rotationKeys = Object.keys(safe.rotation?.counterByPanel ?? {});
  const all: Record<string, true> = {};
  for (const k of streakKeys) all[k] = true;
  for (const k of lastKeys) all[k] = true;
  for (const k of rotationKeys) all[k] = true;
  const totalPanels = Object.keys(all).length;
  let live = 0;
  for (const k of Object.keys(all)) {
    const s = safe.streak?.streakByPanel?.[k] ?? 0;
    const r = safe.rotation?.counterByPanel?.[k] ?? 0;
    if (s > 0 || r > 0) live++;
  }
  const encoded = exportKiwiSessionState(safe);
  const bytes = byteLengthUtf8(encoded);
  const considerAt =
    typeof options.considerTrimBytes === "number" &&
    Number.isFinite(options.considerTrimBytes) &&
    options.considerTrimBytes >= 0
      ? options.considerTrimBytes
      : 2048;
  const trimNowAt =
    typeof options.trimNowBytes === "number" &&
    Number.isFinite(options.trimNowBytes) &&
    options.trimNowBytes >= considerAt
      ? options.trimNowBytes
      : 8192;
  let recommendation: KiwiSessionSizeAuditResult["recommendation"] = "ok";
  if (bytes >= trimNowAt) recommendation = "trim_now";
  else if (bytes >= considerAt) recommendation = "consider_trim";
  return {
    totalPanels,
    livePanels: live,
    encodedByteCount: bytes,
    recommendation,
  };
}
