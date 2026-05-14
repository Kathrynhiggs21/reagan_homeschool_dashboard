/**
 * Push 127 (2026-05-13) — Slay Charge ⚡ reroll audit + rate-limit helper.
 *
 * Pure decision module that the today.slayChargeReroll tRPC mutation
 * calls before/after running pickSlayChargeForDay(). It exists because:
 *
 *   1. We want a per-day rate-limit on rerolls so the kid app can't be
 *      tapped 200 times a minute; cap at 12 rerolls per family-local day.
 *   2. We want a deterministic next reroll index — caller passes the
 *      "rerolls used so far today" and we hand back the index to use.
 *   3. We want a structured audit log row (kid id, timestamp, dateIso,
 *      prevIndex, nextIndex, reason) so Mom can later see "Reagan rolled
 *      6 times on Tuesday" without spelunking through server logs.
 *   4. The audit log row is small enough to live in the existing
 *      `kidActivityLog` table without a schema change.
 *
 * Pure module — no DB, no I/O. Caller owns persistence.
 */

export const SLAY_CHARGE_REROLL_DAILY_CAP = 12;

export type SlayChargeRerollReason =
  | "kid-tap"
  | "auto-rotate-on-load"
  | "adult-preview";

export type SlayChargeRerollDecisionKind =
  | "allow"
  | "deny-rate-limit"
  | "deny-bad-input";

export interface SlayChargeRerollDecisionInput {
  /** YYYY-MM-DD in family TZ. */
  dateIso: string;
  /** How many rerolls already used today (0 = first reroll). */
  prevIndex: number;
  /** Why this reroll happened. */
  reason: SlayChargeRerollReason;
  /** Kid id (or "preview" for adult preview). */
  actorId: string;
  /** Pinned now() in epoch ms — caller supplies for determinism. */
  nowMs: number;
}

export interface SlayChargeRerollAuditRow {
  /** Always "slay-charge-reroll" so audit consumers can filter cheaply. */
  kind: "slay-charge-reroll";
  actorId: string;
  dateIso: string;
  prevIndex: number;
  nextIndex: number;
  reason: SlayChargeRerollReason;
  decidedAtMs: number;
}

export type SlayChargeRerollDecision =
  | {
      kind: "allow";
      nextIndex: number;
      audit: SlayChargeRerollAuditRow;
    }
  | {
      kind: "deny-rate-limit";
      reason: "daily-cap-reached";
      capLimit: number;
      audit: null;
    }
  | {
      kind: "deny-bad-input";
      reason:
        | "missing-date"
        | "bad-date"
        | "negative-prev-index"
        | "non-finite-prev-index"
        | "empty-actor";
      audit: null;
    };

export function decideSlayChargeReroll(
  input: SlayChargeRerollDecisionInput,
): SlayChargeRerollDecision {
  // Defensive validation — never trust the request payload.
  const dateIso = typeof input?.dateIso === "string" ? input.dateIso.trim() : "";
  if (dateIso.length === 0) {
    return { kind: "deny-bad-input", reason: "missing-date", audit: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return { kind: "deny-bad-input", reason: "bad-date", audit: null };
  }
  if (!Number.isFinite(input?.prevIndex)) {
    return {
      kind: "deny-bad-input",
      reason: "non-finite-prev-index",
      audit: null,
    };
  }
  if ((input.prevIndex as number) < 0) {
    return {
      kind: "deny-bad-input",
      reason: "negative-prev-index",
      audit: null,
    };
  }
  const actorId = typeof input?.actorId === "string" ? input.actorId.trim() : "";
  if (actorId.length === 0) {
    return { kind: "deny-bad-input", reason: "empty-actor", audit: null };
  }

  const prevIndex = Math.floor(input.prevIndex as number);

  // Adult-preview reason bypasses the daily cap (Mom is not the kid).
  if (input.reason !== "adult-preview" && prevIndex >= SLAY_CHARGE_REROLL_DAILY_CAP) {
    return {
      kind: "deny-rate-limit",
      reason: "daily-cap-reached",
      capLimit: SLAY_CHARGE_REROLL_DAILY_CAP,
      audit: null,
    };
  }

  const nextIndex = prevIndex + 1;
  const nowMs = Number.isFinite(input?.nowMs) ? (input.nowMs as number) : 0;

  return {
    kind: "allow",
    nextIndex,
    audit: {
      kind: "slay-charge-reroll",
      actorId,
      dateIso,
      prevIndex,
      nextIndex,
      reason: input.reason,
      decidedAtMs: nowMs,
    },
  };
}

/**
 * Convenience predicate the kid UI uses to disable the 🔄 button when
 * the cap has been reached. Adult-preview reason is implicitly off-cap.
 */
export function isRerollAllowed(input: {
  prevIndex: number;
  reason: SlayChargeRerollReason;
}): boolean {
  if (input.reason === "adult-preview") return true;
  if (!Number.isFinite(input?.prevIndex)) return false;
  return Math.floor(input.prevIndex) < SLAY_CHARGE_REROLL_DAILY_CAP;
}
