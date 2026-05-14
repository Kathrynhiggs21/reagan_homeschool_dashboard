/**
 * Push 132 (2026-05-13) — Khan / IXL deeplink "open-tracker" pure helper.
 *
 * Standing rule (project memory):
 *   "Extra spelling practice / Khan / IXL links integrate with a coin-based
 *    reward system. Sample practices that automatically open for treatable
 *    to-do of school time."
 *
 * The procedure surface is `openHelpers.openDeeplink` (registered downstream).
 * This pure helper decides:
 *   1. is the request authorized (kid vs adult tier)?
 *   2. should this open burn or earn coins (small earn for kid school-time
 *      opens; nothing for adult preview/QA opens)?
 *   3. produce a stable openId for the audit-log row, idempotent on
 *      (kidUserId, dateIso, provider, subject, topic, openSlot).
 *
 * No DB. No side-effects. Returns a "plan" the procedure layer applies.
 */

import {
  buildKhanIxlDeeplink,
  type CanonicalSubject,
  type DeeplinkProvider,
} from "./khanIxlDeeplink";

export type AudienceTier = "kid" | "adult";

export interface DeeplinkOpenInput {
  /** Stable kid identity id (or adult open-id when audienceTier=adult). */
  userOpenId: string;
  audienceTier: AudienceTier;
  subject: CanonicalSubject | string;
  provider: DeeplinkProvider | string;
  topic?: string | null;
  /** YYYY-MM-DD; the family-local school day this open is tagged to. */
  dateIso: string;
  /**
   * Cluster of opens within a single day so the tracker can dedupe rapid
   * double-clicks — minute-of-day bucket id, or any deterministic group key.
   * Default "default" — most callers pass the schedule blockId.
   */
  openSlot?: string;
  /**
   * Nominal coins to earn for a kid open during school time. The tracker
   * decides whether to actually award them. Default 1.
   */
  schoolTimeOpenCoinReward?: number;
}

export type DeeplinkOpenOutcome =
  | {
      kind: "ready";
      openId: string;
      url: string;
      coinDelta: number;
      coinReason: string | null;
      auditTag: "kid-school-open" | "adult-preview" | "kid-out-of-school";
    }
  | {
      kind: "blocked";
      reason:
        | "bad-date"
        | "missing-user"
        | "deeplink-build-failed"
        | "non-positive-reward";
    };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isSchoolTime(dateIso: string): boolean {
  // School time ⇔ Mon–Fri (per project memory: weekend agenda is Slay
  // Charge ⚡ + free play, no academic coin earn).
  // Date string is parsed as UTC midnight; that matches family-local Mon–Fri
  // because the dateIso comes from the family-tz day boundary.
  const d = new Date(dateIso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const dow = d.getUTCDay();
  return dow >= 1 && dow <= 5;
}

export function planDeeplinkOpen(input: DeeplinkOpenInput): DeeplinkOpenOutcome {
  if (!ISO_DATE.test(input.dateIso)) {
    return { kind: "blocked", reason: "bad-date" };
  }
  if (!input.userOpenId || input.userOpenId.trim().length === 0) {
    return { kind: "blocked", reason: "missing-user" };
  }
  const reward = input.schoolTimeOpenCoinReward ?? 1;
  if (!Number.isFinite(reward) || reward <= 0) {
    return { kind: "blocked", reason: "non-positive-reward" };
  }

  const built = buildKhanIxlDeeplink({
    subject: input.subject,
    provider: input.provider,
    topic: input.topic ?? null,
  });
  if (!built.ok) {
    return { kind: "blocked", reason: "deeplink-build-failed" };
  }

  const slot = input.openSlot && input.openSlot.length > 0
    ? input.openSlot
    : "default";

  const openId = [
    "open",
    input.userOpenId,
    input.dateIso,
    built.plan.provider,
    built.plan.subject,
    built.plan.topic ?? "_root",
    slot,
  ].join(":");

  if (input.audienceTier === "adult") {
    return {
      kind: "ready",
      openId,
      url: built.plan.url,
      coinDelta: 0,
      coinReason: null,
      auditTag: "adult-preview",
    };
  }

  // Kid tier — coin earn only on school-time (Mon–Fri).
  if (!isSchoolTime(input.dateIso)) {
    return {
      kind: "ready",
      openId,
      url: built.plan.url,
      coinDelta: 0,
      coinReason: null,
      auditTag: "kid-out-of-school",
    };
  }

  return {
    kind: "ready",
    openId,
    url: built.plan.url,
    coinDelta: reward,
    coinReason: `school-time-open:${built.plan.provider}:${built.plan.subject}`,
    auditTag: "kid-school-open",
  };
}
