/**
 * approvalDecider — Slice 3.5
 *
 * Given a pending action (kind + payload), returns whether the AI should
 * auto-approve or escalate to Mom + Grandma via Manus push notification.
 *
 * Hard rules (NEVER auto-approve, always escalate):
 *   - tutor_add / tutor_remove
 *   - credential_add (new learning-app password)
 *   - student_email_change
 *   - email_block_change (esp. unblocking ihsd.us)
 *   - coin_redemption with amount > 20
 *   - year_plan_target_change
 *   - day_reset submitted by Reagan (the student) herself
 *   - any duplicate request from the same user within 1 hour (>3 of same kind)
 *
 * Soft rules (auto-approve when on-task, escalate otherwise):
 *   - day_reset: AI auto-approves only if it's before 9 AM local AND no
 *     completed blocks would be lost.
 *   - summer_mode_early: auto-approves only on/after Jun 1 AND backbone is ≥80% done.
 *   - vacation_off_range: auto-approves up to 7 consecutive days.
 *   - ai_agenda_edit_large (>3 blocks at once): escalate.
 *
 * Anything not listed above defaults to AUTO_APPROVE — routine edits, single
 * block changes, etc. should never have come through this decider in the
 * first place; if they do, we let them through and audit.
 */

export type ApprovalKind =
  | "day_reset"
  | "summer_mode_early"
  | "vacation_off_range"
  | "ai_agenda_edit_large"
  | "tutor_add"
  | "tutor_remove"
  | "credential_add"
  | "student_email_change"
  | "email_block_change"
  | "coin_redemption"
  | "year_plan_target_change"
  | string;

export type ApprovalDecision = "auto_approve" | "needs_review";

export interface ApprovalContext {
  /** Kind of change being submitted. */
  kind: ApprovalKind;
  /** Free-form payload describing the change. */
  payload: Record<string, unknown>;
  /** Who submitted: 'admin' | 'tutor' | 'student' | 'system'. */
  requesterRole: "admin" | "tutor" | "student" | "system";
  /** Local clock when the request was submitted (ms epoch). */
  nowMs?: number;
  /** Local hour (0–23) when the request was submitted. */
  localHour?: number;
  /** Number of identical-kind requests by this user in the last hour. */
  recentSameKindCount?: number;
  /** Year-plan completion % (0–100), used by summer_mode_early. */
  yearPlanPercentComplete?: number;
  /** Whether any completed block exists in the affected day (day_reset only). */
  affectedDayHasCompletedBlock?: boolean;
}

export interface ApprovalResult {
  decision: ApprovalDecision;
  reason: string;
}

/** Hard-block kinds that never auto-approve. */
const ALWAYS_ESCALATE: ReadonlySet<string> = new Set([
  "tutor_add",
  "tutor_remove",
  "credential_add",
  "student_email_change",
  "email_block_change",
  "year_plan_target_change",
]);

export function decideApproval(ctx: ApprovalContext): ApprovalResult {
  const now = ctx.nowMs ?? Date.now();
  void now;

  // 1. Hard rules.
  if (ALWAYS_ESCALATE.has(ctx.kind)) {
    return {
      decision: "needs_review",
      reason: `Kind '${ctx.kind}' always requires Mom + Grandma approval (hard rule).`,
    };
  }

  // 2. Repeated identical request → suspicious.
  if ((ctx.recentSameKindCount ?? 0) > 3) {
    return {
      decision: "needs_review",
      reason: `More than 3 '${ctx.kind}' requests in the last hour from this user.`,
    };
  }

  // 3. Reagan-submitted day_reset → escalate.
  if (ctx.kind === "day_reset" && ctx.requesterRole === "student") {
    return {
      decision: "needs_review",
      reason: "Day-reset requests by Reagan herself need an adult.",
    };
  }

  // 4. Coin redemption: >20 coins → escalate.
  if (ctx.kind === "coin_redemption") {
    const amount = Number((ctx.payload as any)?.amount ?? 0);
    if (amount > 20) {
      return {
        decision: "needs_review",
        reason: `Coin redemption of ${amount} (>20) needs approval.`,
      };
    }
    return {
      decision: "auto_approve",
      reason: `Coin redemption of ${amount} (≤20) auto-approved.`,
    };
  }

  // 5. day_reset (adult/tutor): auto-approve only before 9 AM and no completed work lost.
  if (ctx.kind === "day_reset") {
    const beforeNine = (ctx.localHour ?? 12) < 9;
    const noLoss = !ctx.affectedDayHasCompletedBlock;
    if (beforeNine && noLoss) {
      return {
        decision: "auto_approve",
        reason: "Day reset before 9 AM with no completed blocks — auto-approved.",
      };
    }
    return {
      decision: "needs_review",
      reason: !noLoss
        ? "Day reset would discard already-completed blocks — needs approval."
        : "Day reset after 9 AM — needs approval.",
    };
  }

  // 6. summer_mode_early: only on/after Jun 1 and ≥80% backbone done.
  if (ctx.kind === "summer_mode_early") {
    const dateIso = (ctx.payload as any)?.dateIso ?? new Date(now).toISOString();
    const month = new Date(dateIso).getUTCMonth() + 1; // 1-12
    const onOrAfterJun1 = month >= 6;
    const backboneOk = (ctx.yearPlanPercentComplete ?? 0) >= 80;
    if (onOrAfterJun1 && backboneOk) {
      return {
        decision: "auto_approve",
        reason: "On/after June 1 with backbone ≥80% complete — summer mode auto-approved.",
      };
    }
    return {
      decision: "needs_review",
      reason: !onOrAfterJun1
        ? "Summer mode requested before June 1 — needs approval."
        : "Backbone not yet 80% complete — summer mode needs approval.",
    };
  }

  // 7. vacation_off_range: up to 7 consecutive days auto-approved.
  if (ctx.kind === "vacation_off_range") {
    const days = Number((ctx.payload as any)?.consecutiveDays ?? 0);
    if (days > 0 && days <= 7) {
      return {
        decision: "auto_approve",
        reason: `Vacation block of ${days} day(s) (≤7) auto-approved.`,
      };
    }
    return {
      decision: "needs_review",
      reason: `Vacation block of ${days} day(s) (>7 or invalid) needs approval.`,
    };
  }

  // 8. ai_agenda_edit_large: always escalate.
  if (ctx.kind === "ai_agenda_edit_large") {
    return {
      decision: "needs_review",
      reason: "AI agenda edit affects more than 3 blocks at once — needs approval.",
    };
  }

  // 9. Default: auto-approve.
  return {
    decision: "auto_approve",
    reason: `Routine '${ctx.kind}' — auto-approved.`,
  };
}
