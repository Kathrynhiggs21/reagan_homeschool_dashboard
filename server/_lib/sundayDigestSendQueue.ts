/**
 * Push 78 (2026-05-13) — Sunday digest send queue.
 *
 * The actual SMTP wire-up will happen later; this module supplies the
 * deterministic policy + idempotency key + recipient list that the eventual
 * sender will consume.
 *
 * Invariants (locked by sundayDigestSendQueue.test.ts):
 *   - Mom + Grandma are ALWAYS recipients, in that order.
 *   - When extra family-admin recipients are added (e.g. Dad later), they
 *     append after Mom + Grandma without re-ordering.
 *   - Idempotency key is `<weekStart>:<recipient>` so a re-queue for the
 *     same (week, recipient) is a no-op.
 *   - Pure module — no DB, no I/O.
 */

import { isGrandmaEmail, isGrandmaEmailPaused } from "./grandmaAudience";

export interface SundayDigestRecipient {
  email: string;
  displayName: string;
  role: "mom" | "grandma" | "family-admin";
}

export interface QueueDigestSendInput {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  /** Override base set if a household has different default addresses. */
  baseRecipients?: SundayDigestRecipient[];
  /** Extra recipients (e.g. Dad). Appended after the base. */
  extraRecipients?: SundayDigestRecipient[];
}

export interface QueuedDigestSend {
  idempotencyKey: string;
  weekStart: string;
  weekEnd: string;
  recipient: SundayDigestRecipient;
}

const DEFAULT_BASE: SundayDigestRecipient[] = [
  { email: "reaganhiggs910@gmail.com", displayName: "Mom (Reagan)", role: "mom" },
  { email: "marcy.spear@gmail.com", displayName: "Grandma Marcy", role: "grandma" },
];

/**
 * Build the ordered list of queued sends. The caller persists / sends them.
 */
export function planSundayDigestSend(
  input: QueueDigestSendInput,
): QueuedDigestSend[] {
  const base = input.baseRecipients ?? DEFAULT_BASE;
  const extras = input.extraRecipients ?? [];
  // De-dup by email (case-insensitive) while preserving order: base first.
  const seen = new Set<string>();
  const ordered: SundayDigestRecipient[] = [];
  for (const r of [...base, ...extras]) {
    const k = r.email.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      ordered.push(r);
    }
  }
  // 2026-06-18: Grandma email paused — drop her from the queued send while
  // the pause is on (single flag in grandmaAudience.ts).
  const visible = isGrandmaEmailPaused()
    ? ordered.filter((r) => !isGrandmaEmail(r.email))
    : ordered;
  return visible.map((r) => ({
    idempotencyKey: `${input.weekStart}:${r.email.trim().toLowerCase()}`,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    recipient: r,
  }));
}

/**
 * Merge a fresh plan with an existing list of already-queued idempotency
 * keys; returns only the new sends that should actually be enqueued.
 */
export function dedupePlannedSends(
  plan: QueuedDigestSend[],
  alreadyQueuedKeys: string[],
): QueuedDigestSend[] {
  const known = new Set(alreadyQueuedKeys);
  return plan.filter((p) => !known.has(p.idempotencyKey));
}
