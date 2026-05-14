/**
 * Push 126 (2026-05-13) — Schedule-change request flow orchestrator.
 *
 * Glues the kid-side submit (Push 96 presets + Push 111 routing) to the
 * adult-side approval ledger (Push 113 banner) into a single decision
 * the request-submit endpoint can call once. Caller hands in:
 *   - the kid request (kind="schedule-change", body)
 *   - the current ledger state for the active pending change, if any
 *   - the recipient roster overrides (Mom / Grandma / Dad)
 *
 * The orchestrator returns the plan the endpoint must execute:
 *   - whether to enqueue / replace / reject the request
 *   - what SMS to send to whom (Mom + Grandma always; Dad FYI)
 *   - what banner state Reagan + adults should now see
 *
 * Pure module — no DB, no SMS, no I/O.
 */

import {
  planReaganRequestRouting,
  type ApprovalRoutingPlan,
} from "./reaganRequestRouting";
import {
  planScheduleChangePendingBanner,
  type ApprovalStatus,
  type BannerPlan,
} from "./scheduleChangePendingBanner";

export type ScheduleChangeFlowDecision =
  | "submit-fresh"
  | "replace-superseded"
  | "reject-already-pending-from-reagan"
  | "reject-empty-body"
  | "reject-non-string-body"
  | "reject-not-schedule-kind";

export interface ScheduleChangeFlowInput {
  /** Kid request as it arrived from the request box. */
  kind: "assignment" | "adventure" | "schedule-change";
  body: string;

  /** Optional roster override; defaults to Push 111 defaults. */
  recipients?: {
    mom?: string;
    grandma?: string;
    dad?: string | null;
  };

  /**
   * Current ledger snapshot if Reagan has a pending change already.
   * undefined ⇒ no active pending change.
   */
  pending?: {
    /** epoch ms when pending request was created */
    submittedAtMs: number;
    state: { mom: ApprovalStatus; grandma: ApprovalStatus };
  };

  /** Now() in epoch ms — caller-pinned for determinism. */
  nowMs: number;
}

export interface OutboundSms {
  toEmail: string;
  label: "Mom" | "Grandma" | "Dad";
  required: boolean;
  smsLine: string;
}

export interface ScheduleChangeFlowOutput {
  decision: ScheduleChangeFlowDecision;
  /** True iff endpoint should enqueue. */
  enqueue: boolean;
  /** Routing plan for SMS dispatch (empty when not enqueueing). */
  outbound: ReadonlyArray<OutboundSms>;
  /** Banner config for Reagan's UI right after submit. */
  reaganBanner: BannerPlan;
  /** Banner config for Mom + Grandma's UI right after submit. */
  adultBanner: BannerPlan;
  /** Pass-through for ops logs. */
  routing: ApprovalRoutingPlan;
}

const REPLACE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export function planScheduleChangeFlow(
  input: ScheduleChangeFlowInput,
): ScheduleChangeFlowOutput {
  // Defensive: this orchestrator is schedule-change-only.
  if (input.kind !== "schedule-change") {
    return {
      decision: "reject-not-schedule-kind",
      enqueue: false,
      outbound: [],
      reaganBanner: planScheduleChangePendingBanner({ active: false, audience: "reagan" }),
      adultBanner: planScheduleChangePendingBanner({ active: false, audience: "mom" }),
      routing: {
        ok: false,
        rejectReason: "unknown-kind",
        recipients: [],
        requiresUnanimousApproval: false,
        smsLine: "",
        urgent: false,
      },
    };
  }

  const routing = planReaganRequestRouting({
    kind: "schedule-change",
    body: input.body,
    recipients: input.recipients,
  });

  if (!routing.ok) {
    const decision: ScheduleChangeFlowDecision =
      routing.rejectReason === "empty-body"
        ? "reject-empty-body"
        : routing.rejectReason === "non-string-body"
          ? "reject-non-string-body"
          : "reject-not-schedule-kind";
    return {
      decision,
      enqueue: false,
      outbound: [],
      reaganBanner: planScheduleChangePendingBanner({ active: false, audience: "reagan" }),
      adultBanner: planScheduleChangePendingBanner({ active: false, audience: "mom" }),
      routing,
    };
  }

  // Pending logic: Reagan can have at most one open schedule-change at a
  // time. Re-submits within 1h replace the prior; later resubmits are
  // rejected (the prior is still being voted on; spamming would create
  // dupes in Mom + Grandma's inbox).
  let decision: ScheduleChangeFlowDecision = "submit-fresh";
  let enqueue = true;
  if (input.pending) {
    const ageMs = input.nowMs - input.pending.submittedAtMs;
    const isClosed =
      input.pending.state.mom === "rejected" ||
      input.pending.state.grandma === "rejected" ||
      (input.pending.state.mom === "approved" &&
        input.pending.state.grandma === "approved");
    const stillVotingNeeded = !isClosed && (
      input.pending.state.mom === "pending" ||
      input.pending.state.grandma === "pending"
    );
    if (stillVotingNeeded) {
      if (ageMs >= 0 && ageMs <= REPLACE_THRESHOLD_MS) {
        decision = "replace-superseded";
        // enqueue stays true — caller invalidates the old row, queues new SMS.
      } else {
        decision = "reject-already-pending-from-reagan";
        enqueue = false;
      }
    }
    // If both votes are in (applied or rejected), the pending is closed
    // and a fresh submit always proceeds.
  }

  const outbound: OutboundSms[] = enqueue
    ? routing.recipients.map((r) => ({
        toEmail: r.email,
        label: r.label as OutboundSms["label"],
        required: r.required,
        smsLine: routing.smsLine,
      }))
    : [];

  // Banner: after submit, Reagan + adults always see "pending-both" because
  // the new submit resets the vote ledger. (When `enqueue=false` because we
  // rejected a duplicate, we keep the existing pending banner shape so Reagan
  // doesn't think nothing happened — she sees the prior pending status.)
  const bannerInputState =
    enqueue
      ? { mom: "pending" as ApprovalStatus, grandma: "pending" as ApprovalStatus }
      : input.pending?.state ?? {
          mom: "pending" as ApprovalStatus,
          grandma: "pending" as ApprovalStatus,
        };
  const bannerActive = enqueue ? true : !!input.pending;

  const reaganBanner = planScheduleChangePendingBanner({
    active: bannerActive,
    audience: "reagan",
    state: bannerInputState,
  });
  const adultBanner = planScheduleChangePendingBanner({
    active: bannerActive,
    audience: "mom",
    state: bannerInputState,
  });

  return {
    decision,
    enqueue,
    outbound,
    reaganBanner,
    adultBanner,
    routing,
  };
}
