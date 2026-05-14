/**
 * Push 129 (2026-05-13) — Schedule-change SMS dispatch dry-run helper.
 *
 * Mom's rule, captured in project memory:
 *   "Any resets or changes to Reagan's schedule or system settings require
 *    approval from both her mom and grandma. These approval requests
 *    should be sent to their phones."
 *
 * The Push 126 orchestrator (`scheduleChangeFlow`) already decided "this
 * needs Mom + Grandma approval." Push 129 is the next, pure step: turn
 * that abstract decision into the *exact* outbound SMS payloads (one to
 * Mom, one to Grandma) that a dispatcher would send, with a deterministic
 * idempotency key per (requestId, recipientRole) so a retry never doubles
 * up.
 *
 * No I/O, no Twilio call. Inputs in, payload list out. The actual sender
 * lives downstream and must respect the `idempotencyKey` field.
 */

export type ScheduleChangeSmsRecipientRole = "mom" | "grandma" | "dad-fyi";

export interface ScheduleChangeRecipient {
  role: ScheduleChangeSmsRecipientRole;
  /** Display name shown in audit logs only — not put in the SMS body. */
  displayName: string;
  /** E.164 phone, e.g. "+15135550199". Required for non-FYI roles. */
  phoneE164: string | null;
}

export interface ScheduleChangeSmsDispatchInput {
  /** Stable id of the request as stored in approvalsRequests. */
  requestId: string;
  /** What Reagan asked for, in her own short words. */
  reaganSummary: string;
  /** YYYY-MM-DD (the school day the change targets). */
  forDateIso: string;
  /** True for "scared / sick / hurt" Push 111 urgent flag. */
  urgent: boolean;
  /** Approval flow the dispatcher will use (matches Push 126). */
  approveTokenUrl: string;
  rejectTokenUrl: string;
  /** Resolved recipients (Mom + Grandma required, Dad optional FYI). */
  recipients: ReadonlyArray<ScheduleChangeRecipient>;
  /** Now, ms. Used only for the audit timestamp on the payload. */
  nowMs: number;
}

export type ScheduleChangeSmsDispatchOutcome =
  | {
      kind: "ready";
      payloads: ReadonlyArray<ScheduleChangeSmsPayload>;
      skippedReasons: ReadonlyArray<{
        role: ScheduleChangeSmsRecipientRole;
        reason: ScheduleChangeSmsSkipReason;
      }>;
    }
  | {
      kind: "blocked";
      reason: ScheduleChangeSmsBlockReason;
    };

export type ScheduleChangeSmsSkipReason =
  | "missing-phone"
  | "fyi-role-no-vote-needed"
  | "duplicate-role";

export type ScheduleChangeSmsBlockReason =
  | "missing-mom-approver"
  | "missing-grandma-approver"
  | "missing-request-id"
  | "missing-summary"
  | "bad-date"
  | "no-recipients";

export interface ScheduleChangeSmsPayload {
  role: ScheduleChangeSmsRecipientRole;
  toPhoneE164: string;
  body: string;
  /** Stable per (requestId, role) for retry-safe dispatch. */
  idempotencyKey: string;
  audit: {
    requestId: string;
    role: ScheduleChangeSmsRecipientRole;
    forDateIso: string;
    urgent: boolean;
    builtAtMs: number;
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isE164(phone: string | null): phone is string {
  return typeof phone === "string" && /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Compose the SMS body for a schedule-change vote prompt.
 *
 * Kept short on purpose — many carriers split >160 chars across segments,
 * and Mom + Grandma both prefer the one-segment "ask, decide, tap" feel.
 */
export function composeScheduleChangeSmsBody(args: {
  role: ScheduleChangeSmsRecipientRole;
  reaganSummary: string;
  forDateIso: string;
  urgent: boolean;
  approveTokenUrl: string;
  rejectTokenUrl: string;
}): string {
  const trimmedSummary = args.reaganSummary.trim().slice(0, 90);
  const urgentTag = args.urgent ? "URGENT — " : "";
  const greet =
    args.role === "mom" ? "Mom" : args.role === "grandma" ? "Grandma" : "FYI";
  // Shorter URL-friendly date label.
  const dateLabel = args.forDateIso;
  return [
    `${urgentTag}${greet}: Reagan asks (${dateLabel})`,
    `"${trimmedSummary}"`,
    `OK: ${args.approveTokenUrl}`,
    `No: ${args.rejectTokenUrl}`,
  ].join("\n");
}

/**
 * Compute a stable idempotency key for (requestId, role).
 *
 * NEVER includes a timestamp or random — replays from the dispatcher
 * MUST collide, otherwise we'd send Mom the same vote twice.
 */
export function scheduleChangeSmsIdempotencyKey(
  requestId: string,
  role: ScheduleChangeSmsRecipientRole,
): string {
  return `sched-change-sms:${requestId}:${role}`;
}

export function planScheduleChangeSmsDispatch(
  input: ScheduleChangeSmsDispatchInput,
): ScheduleChangeSmsDispatchOutcome {
  if (!input.requestId || input.requestId.trim().length === 0) {
    return { kind: "blocked", reason: "missing-request-id" };
  }
  if (!input.reaganSummary || input.reaganSummary.trim().length === 0) {
    return { kind: "blocked", reason: "missing-summary" };
  }
  if (!ISO_DATE.test(input.forDateIso)) {
    return { kind: "blocked", reason: "bad-date" };
  }
  if (!input.recipients || input.recipients.length === 0) {
    return { kind: "blocked", reason: "no-recipients" };
  }

  const seenRoles = new Set<ScheduleChangeSmsRecipientRole>();
  const skipped: Array<{
    role: ScheduleChangeSmsRecipientRole;
    reason: ScheduleChangeSmsSkipReason;
  }> = [];
  const payloads: ScheduleChangeSmsPayload[] = [];

  let momPresent = false;
  let grandmaPresent = false;

  for (const r of input.recipients) {
    if (seenRoles.has(r.role)) {
      skipped.push({ role: r.role, reason: "duplicate-role" });
      continue;
    }
    seenRoles.add(r.role);

    if (r.role === "dad-fyi") {
      // Dad is FYI per Push 111 routing — no SMS vote needed.
      skipped.push({ role: r.role, reason: "fyi-role-no-vote-needed" });
      continue;
    }

    if (!isE164(r.phoneE164)) {
      skipped.push({ role: r.role, reason: "missing-phone" });
      continue;
    }

    if (r.role === "mom") momPresent = true;
    if (r.role === "grandma") grandmaPresent = true;

    const body = composeScheduleChangeSmsBody({
      role: r.role,
      reaganSummary: input.reaganSummary,
      forDateIso: input.forDateIso,
      urgent: input.urgent,
      approveTokenUrl: input.approveTokenUrl,
      rejectTokenUrl: input.rejectTokenUrl,
    });

    payloads.push({
      role: r.role,
      toPhoneE164: r.phoneE164,
      body,
      idempotencyKey: scheduleChangeSmsIdempotencyKey(input.requestId, r.role),
      audit: {
        requestId: input.requestId,
        role: r.role,
        forDateIso: input.forDateIso,
        urgent: input.urgent,
        builtAtMs: input.nowMs,
      },
    });
  }

  // Mom + Grandma are both REQUIRED for schedule changes (Push 126).
  if (!momPresent) {
    return { kind: "blocked", reason: "missing-mom-approver" };
  }
  if (!grandmaPresent) {
    return { kind: "blocked", reason: "missing-grandma-approver" };
  }

  return { kind: "ready", payloads, skippedReasons: skipped };
}
