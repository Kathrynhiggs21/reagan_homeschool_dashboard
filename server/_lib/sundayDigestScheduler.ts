/**
 * Push 85 (2026-05-13) — Sunday weekly digest scheduler (pure helpers).
 *
 * Decides whether the current moment is the Sunday-evening send window and
 * builds idempotency keys so the same (week, recipient) pair is never
 * enqueued twice. No DB writes; the actual send is performed by Push 78's
 * sundayDigestSendQueue, which calls these helpers from a scheduled job.
 *
 * Defaults (Mom locked these in 2026-04-22):
 *  - Sunday (dayOfWeek = 0)
 *  - 7 PM local hour (hour = 19)
 *  - Window is 60 minutes (one hour-bucket per week, prevents minute-jitter).
 */

import { createHash } from "node:crypto";

export interface DigestWindowOpts {
  /** 0 = Sunday … 6 = Saturday. Defaults to 0 (Sunday). */
  dayOfWeek?: number;
  /** 0–23, local-time hour the send window opens. Defaults to 19 (7 PM). */
  hour?: number;
  /** Duration of the send window in minutes. Defaults to 60. */
  durationMin?: number;
}

const DEFAULTS: Required<DigestWindowOpts> = {
  dayOfWeek: 0,
  hour: 19,
  durationMin: 60,
};

/**
 * Returns true when `now` falls inside the configured Sunday send window.
 * Uses the host's local timezone (Settings shows Mom is on America/Chicago).
 */
export function isDigestSendWindow(
  now: Date,
  opts: DigestWindowOpts = {},
): boolean {
  const cfg = { ...DEFAULTS, ...opts };
  if (now.getDay() !== cfg.dayOfWeek) return false;
  const hourNow = now.getHours();
  const minuteNow = now.getMinutes();
  if (hourNow < cfg.hour) return false;
  const minutesIntoWindow = (hourNow - cfg.hour) * 60 + minuteNow;
  return minutesIntoWindow < cfg.durationMin;
}

/**
 * Returns the ISO date (YYYY-MM-DD) of the Sunday that anchors the week
 * being digested. If `date` is itself a Sunday, returns that same date.
 * This is the canonical "weekStartISO" used across the send queue and the
 * idempotency keys, so retries can never double-send.
 */
export function weekStartFor(date: Date): string {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = out.getDay();
  out.setDate(out.getDate() - day);
  return toIsoDay(out);
}

/**
 * Stable idempotency key per (weekStartISO, recipientEmail). Case-folded
 * email avoids accidental dupes from differing case. Hash output is short
 * (12 hex chars) — enough for collision avoidance within a single week,
 * never used for security.
 */
export function digestIdempotencyKey(
  weekStartISO: string,
  recipientEmail: string,
): string {
  const normalized = `${weekStartISO}|${recipientEmail.trim().toLowerCase()}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

export interface DigestRecipient {
  email: string;
  role: "mom" | "grandma" | "tutor" | "admin";
}

export interface DigestDispatchPlan {
  recipient: DigestRecipient;
  idempotencyKey: string;
  weekStartISO: string;
}

/**
 * Orchestrator: given `now`, the recipient list, and the set of
 * idempotency keys already enqueued, returns the list of dispatch plans
 * to enqueue. Outside the send window the result is always empty.
 *
 * Per Mom's rule, Mom and Grandma are always in the recipient list — the
 * caller (Push 78 send queue) is responsible for guaranteeing that; this
 * helper just trusts the input and de-duplicates by idempotency key.
 */
export function decideDigestSends(
  now: Date,
  recipients: ReadonlyArray<DigestRecipient>,
  alreadySentKeys: ReadonlySet<string>,
  opts: DigestWindowOpts = {},
): DigestDispatchPlan[] {
  if (!isDigestSendWindow(now, opts)) return [];
  const weekStartISO = weekStartFor(now);
  const plans: DigestDispatchPlan[] = [];
  for (const r of recipients) {
    const idempotencyKey = digestIdempotencyKey(weekStartISO, r.email);
    if (alreadySentKeys.has(idempotencyKey)) continue;
    plans.push({ recipient: r, idempotencyKey, weekStartISO });
  }
  return plans;
}

function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
