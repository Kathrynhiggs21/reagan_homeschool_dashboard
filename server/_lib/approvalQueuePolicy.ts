/**
 * Push 77 (2026-05-13) — Approval queue policy.
 *
 * Mom (family-admin) and Grandma Marcy (family-admin) are NEVER queued —
 * any change they request is auto-approved at write-time. Only tutors,
 * the AI assistant, and the system itself can produce queued approvals.
 *
 * Pure module: no DB, no I/O. Just a decision function.
 */

export type RequesterRole =
  | "mom"
  | "grandma"
  | "tutor"
  | "assistant"
  | "system"
  | "kid"
  | "unknown";

/** Catalogue of risky change kinds that go through the SMS approval flow. */
export const APPROVAL_RISK_KINDS = [
  "schedule.bulk-delete",
  "schedule.replace-week",
  "curriculum.unmap-topic",
  "tutor.add-or-remove",
  "settings.disable-recap",
  "settings.reset-coins",
  "blocks.bulk-edit",
  "calendar.sync-disable",
] as const;
export type ApprovalRiskKind = (typeof APPROVAL_RISK_KINDS)[number];

export type ApprovalDecision =
  | { queue: false; reason: "family-admin-auto-approve" }
  | { queue: false; reason: "low-risk-not-queueable" }
  | { queue: true; reason: "risky-change-by-non-family-admin" };

const FAMILY_ADMIN_ROLES = new Set<RequesterRole>(["mom", "grandma"]);

export function shouldQueueApproval(
  requesterRole: RequesterRole,
  kind: string,
): ApprovalDecision {
  // Rule 1: Mom + Grandma are never queued, regardless of risk kind.
  if (FAMILY_ADMIN_ROLES.has(requesterRole)) {
    return { queue: false, reason: "family-admin-auto-approve" };
  }
  // Rule 2: only the catalogued risky kinds are queueable; anything else
  // proceeds without an approval row (caller may still log it elsewhere).
  if (!(APPROVAL_RISK_KINDS as readonly string[]).includes(kind)) {
    return { queue: false, reason: "low-risk-not-queueable" };
  }
  return { queue: true, reason: "risky-change-by-non-family-admin" };
}

/**
 * Round-trip helper for queue policy + token TTL. Returns the queue
 * decision and (when queued) a recommended expiry timestamp `nowMs +
 * ttlMs` (default 24h). Callers can pass this expiry directly into
 * signSmsApprovalToken.
 */
export function planApprovalQueue(
  requesterRole: RequesterRole,
  kind: string,
  nowMs: number = Date.now(),
  ttlMs: number = 24 * 60 * 60 * 1000,
): ApprovalDecision & { expiresAtMs?: number } {
  const decision = shouldQueueApproval(requesterRole, kind);
  if (!decision.queue) return decision;
  return { ...decision, expiresAtMs: nowMs + ttlMs };
}
