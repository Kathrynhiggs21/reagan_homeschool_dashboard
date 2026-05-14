/**
 * Push 124 (2026-05-13) — Sunday digest send-plan orchestrator.
 *
 * Pure module. Glues together the four pieces that were previously
 * built as isolated helpers so the eventual cron/SMTP layer only has
 * to call ONE thing:
 *
 *   - Push 108 sundayDigestGating.evaluateSundayDigestGate
 *       → "is this the right family-local moment to send?"
 *   - Push 94  digestRecipientsToggle.resolveDigestRecipients
 *       → "who exactly should the email go to?"
 *       (Mom permanent, Grandma on-by-default, optional extras)
 *   - Push 78  sundayDigestSendQueue.dedupePlannedSends
 *       → "have we already queued any of these?"
 *   - Push 109 sundayDigestBody.composeSundayDigestBody
 *       → "what does the email body look like for THIS audience?"
 *
 * Mirrors the planRecapSend pattern from recapEmailQueue.ts so the
 * downstream sender has a uniform shape and skip reasons.
 *
 * No DB, no I/O.
 */

import {
  evaluateSundayDigestGate,
  type DigestGateOutcome,
} from "./sundayDigestGating";
import {
  resolveDigestRecipients,
  grandmaMuteBanner,
} from "./digestRecipientsToggle";
import type { SundayDigestRecipient } from "./sundayDigestSendQueue";
import {
  composeSundayDigestBody,
  audienceFromEmail,
  type DigestSnapshot,
  type DigestBody,
} from "./sundayDigestBody";

export type DigestSkipReason =
  | "outside-send-window"
  | "already-sent-this-week"
  | "invalid-now"
  | "all-recipients-already-queued"
  | "no-recipients";

export interface PlannedDigestSend {
  toEmail: string;
  toDisplayName: string;
  role: SundayDigestRecipient["role"];
  audience: DigestBody["audience"];
  subject: string;
  body: DigestBody;
  weekStartIso: string;
  weekEndIso: string;
  idempotencyKey: string;
}

export interface DigestSendPlan {
  /** Empty when skipped. */
  sends: PlannedDigestSend[];
  /** Set when the gate or dedupe blocked everything. */
  skipReason: DigestSkipReason | null;
  /** Mirrors the WeeklyDigestCard banner so the cron log can echo it. */
  grandmaMutedBanner: { show: true; message: string } | { show: false };
  /** Pass-through gate evaluation for ops visibility. */
  gate: DigestGateOutcome;
}

export interface PlanSundayDigestInput {
  /** Snapshot fed to the body composer. */
  snapshot: DigestSnapshot;
  /** Whether Grandma is enabled this week (Mom toggle). */
  grandmaEnabled: boolean;
  /** Optional extra recipients (e.g. Dad, tutor). */
  extras?: SundayDigestRecipient[];
  /** UNIX ms now (passed to the gate). */
  nowMs: number;
  /** Last successful send ISO, if any (passed to the gate). */
  lastSentAtIso?: string | null;
  /** Idempotency keys already enqueued to dedupe against. */
  alreadyQueuedKeys?: string[];
}

function idempotencyKey(weekStartIso: string, email: string): string {
  return `${weekStartIso.slice(0, 10)}:${email.trim().toLowerCase()}`;
}

/**
 * Build the deterministic dispatch plan. Caller persists / sends the
 * resulting `sends` array.
 */
export function planSundayDigestSend(
  input: PlanSundayDigestInput,
): DigestSendPlan {
  const gate = evaluateSundayDigestGate({
    now: new Date(input.nowMs),
    lastSentAtIso: input.lastSentAtIso ?? null,
  });

  const grandmaMutedBanner = grandmaMuteBanner({
    grandmaEnabled: input.grandmaEnabled,
  });

  // Gate first — if we're not in the window or already sent, no plan.
  if (!gate.allow) {
    let skipReason: DigestSkipReason;
    switch (gate.reason) {
      case "already-sent-this-week":
        skipReason = "already-sent-this-week";
        break;
      case "invalid-now":
        skipReason = "invalid-now";
        break;
      default:
        skipReason = "outside-send-window";
    }
    return {
      sends: [],
      skipReason,
      grandmaMutedBanner,
      gate,
    };
  }

  // Resolve recipients respecting the Grandma toggle + extras.
  const resolved = resolveDigestRecipients({
    grandmaEnabled: input.grandmaEnabled,
    extras: input.extras,
  });

  if (resolved.recipients.length === 0) {
    return {
      sends: [],
      skipReason: "no-recipients",
      grandmaMutedBanner,
      gate,
    };
  }

  // Compose the body once per audience (cheaper + consistent).
  const bodyByAudience = new Map<DigestBody["audience"], DigestBody>();
  function bodyFor(audience: DigestBody["audience"]): DigestBody {
    const existing = bodyByAudience.get(audience);
    if (existing) return existing;
    const fresh = composeSundayDigestBody({
      audience,
      snapshot: input.snapshot,
    });
    bodyByAudience.set(audience, fresh);
    return fresh;
  }

  const known = new Set((input.alreadyQueuedKeys ?? []).map((k) => k));
  const sends: PlannedDigestSend[] = [];
  for (const r of resolved.recipients) {
    const audience: DigestBody["audience"] =
      r.role === "mom"
        ? "mom"
        : r.role === "grandma"
          ? "grandma"
          : audienceFromEmail(r.email);
    const body = bodyFor(audience);
    const key = idempotencyKey(input.snapshot.weekStartIso, r.email);
    if (known.has(key)) continue;
    sends.push({
      toEmail: r.email,
      toDisplayName: r.displayName,
      role: r.role,
      audience,
      subject: body.subject,
      body,
      weekStartIso: input.snapshot.weekStartIso,
      weekEndIso: input.snapshot.weekEndIso,
      idempotencyKey: key,
    });
  }

  if (sends.length === 0) {
    return {
      sends: [],
      skipReason: "all-recipients-already-queued",
      grandmaMutedBanner,
      gate,
    };
  }

  return { sends, skipReason: null, grandmaMutedBanner, gate };
}
