/**
 * Push 113 (2026-05-13) — Schedule-change unanimous-pending banner helper.
 *
 * Pure helper that the Today / Schedule UI uses to render a banner like
 *   "Schedule change pending — waiting on Grandma"
 *   "Schedule change pending — waiting on Mom"
 *   "Schedule change pending — waiting on Mom + Grandma"
 *   "Schedule change applied"  (when both have approved)
 *   "Schedule change rejected by Mom" (when one rejects)
 *
 * Reagan's UI shows the friendly version. Mom + Grandma's UI shows the
 * approver-name list so they can act. The banner self-hides when there
 * is no pending change (`shouldShow=false`).
 *
 * House rules from project knowledge:
 *   - Schedule changes need Mom AND Grandma both to approve.
 *   - Reagan cannot change schedules; she only requests.
 *   - Rejection by either approver halts the change immediately.
 *
 * Pure module, no DB, no I/O.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ScheduleChangeApprovalState {
  /** Mom's vote. */
  mom: ApprovalStatus;
  /** Grandma's vote. */
  grandma: ApprovalStatus;
}

export type BannerAudience = "reagan" | "mom" | "grandma" | "viewer";

export type BannerOutcome =
  | "applied"
  | "rejected-by-mom"
  | "rejected-by-grandma"
  | "rejected-by-both"
  | "pending-mom"
  | "pending-grandma"
  | "pending-both"
  | "no-change-active";

export interface BannerPlan {
  shouldShow: boolean;
  outcome: BannerOutcome;
  /** Banner copy specific to the audience. */
  text: string;
  /** Color tone hint for the UI. */
  tone: "info" | "warn" | "success" | "danger";
  /** Reagan-friendly tag — true if banner shows kid-safe wording. */
  kidSafe: boolean;
}

function classify(state: ScheduleChangeApprovalState): BannerOutcome {
  const { mom, grandma } = state;
  if (mom === "rejected" && grandma === "rejected") return "rejected-by-both";
  if (mom === "rejected") return "rejected-by-mom";
  if (grandma === "rejected") return "rejected-by-grandma";
  if (mom === "approved" && grandma === "approved") return "applied";
  if (mom === "approved" && grandma === "pending") return "pending-grandma";
  if (mom === "pending" && grandma === "approved") return "pending-mom";
  if (mom === "pending" && grandma === "pending") return "pending-both";
  // Defensive default — both fields missing values that don't match the enum.
  return "no-change-active";
}

export function planScheduleChangePendingBanner(input: {
  active: boolean;
  audience: BannerAudience;
  state?: ScheduleChangeApprovalState;
}): BannerPlan {
  if (!input.active || !input.state) {
    return {
      shouldShow: false,
      outcome: "no-change-active",
      text: "",
      tone: "info",
      kidSafe: true,
    };
  }
  const outcome = classify(input.state);

  // Applied / rejected outcomes cap how long the banner shows in the UI;
  // the helper still returns shouldShow=true so the UI can fade it.
  const baseShow = outcome !== "no-change-active";

  let text: string;
  let tone: BannerPlan["tone"] = "info";
  let kidSafe = true;

  switch (outcome) {
    case "applied":
      text =
        input.audience === "reagan"
          ? "Schedule change approved! Your day is updated."
          : "Schedule change applied (Mom + Grandma both approved).";
      tone = "success";
      break;
    case "rejected-by-mom":
      text =
        input.audience === "reagan"
          ? "Schedule change wasn't approved this time. Talk to Mom if you'd like to ask again."
          : "Schedule change rejected by Mom.";
      tone = "danger";
      break;
    case "rejected-by-grandma":
      text =
        input.audience === "reagan"
          ? "Schedule change wasn't approved this time. Talk to Mom or Grandma if you'd like to ask again."
          : "Schedule change rejected by Grandma.";
      tone = "danger";
      break;
    case "rejected-by-both":
      text =
        input.audience === "reagan"
          ? "Schedule change wasn't approved this time. The day stays as-is."
          : "Schedule change rejected by both Mom and Grandma.";
      tone = "danger";
      break;
    case "pending-mom":
      text =
        input.audience === "reagan"
          ? "Schedule change is being looked at — waiting on a grown-up."
          : "Schedule change pending — waiting on Mom";
      tone = "warn";
      kidSafe = input.audience === "reagan";
      break;
    case "pending-grandma":
      text =
        input.audience === "reagan"
          ? "Schedule change is being looked at — waiting on a grown-up."
          : "Schedule change pending — waiting on Grandma";
      tone = "warn";
      kidSafe = input.audience === "reagan";
      break;
    case "pending-both":
      text =
        input.audience === "reagan"
          ? "Schedule change is being looked at — waiting on grown-ups."
          : "Schedule change pending — waiting on Mom + Grandma";
      tone = "warn";
      kidSafe = input.audience === "reagan";
      break;
    default:
      // no-change-active
      return {
        shouldShow: false,
        outcome: "no-change-active",
        text: "",
        tone: "info",
        kidSafe: true,
      };
  }

  return {
    shouldShow: baseShow,
    outcome,
    text,
    tone,
    kidSafe,
  };
}
