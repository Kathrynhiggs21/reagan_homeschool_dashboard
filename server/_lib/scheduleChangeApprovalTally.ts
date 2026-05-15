/**
 * Wave-15 / Push 214 — scheduleChangeApprovalTally
 *
 * Pure deterministic helper. The companion piece to Push 212+213's
 * scheduleChangeRequestBuilder. When Mom or Grandma taps "Approve" /
 * "Decline" on a request from their phone, the upstream code records
 * a per-approver decision in the DB. This helper takes the full
 * decision list for a request and computes the canonical *finalized*
 * status the UI should render + the next-step action the system
 * should take.
 *
 * House rules baked in:
 *   - BOTH adults must approve before a request becomes "approved".
 *   - One decline by either adult makes the request "declined".
 *   - The original requester (Reagan) does NOT have an approve vote
 *     — kid-side opinions are ignored here.
 *   - Voice rules: kidLine + adultLine use calm older-cousin tone.
 *     No "buddy / friend / yay / great job".
 *   - Never punitive: a declined request's kidLine says "Not this
 *     time — they didn't both agree. You can ask again later."
 *     instead of blaming Reagan or the adults.
 *   - Hard-blocked email (reagan.higgs33@ihsd.us) cannot cast a vote.
 *   - Only mom (spear.cpt@gmail.com) and grandma (marcy.spear@gmail.com)
 *     decisions count; everything else is ignored.
 */

export type ApprovalDecision = "approve" | "decline";

export interface ApprovalVote {
  /** Email of the adult casting the vote. */
  voterEmail: string;
  decision: ApprovalDecision;
  /** When the vote was recorded (ISO timestamp). */
  votedAtIso: string;
}

export type ApprovalFinalStatus =
  | "pending" // waiting on at least one of the two adults
  | "approved" // both mom + grandma approved
  | "declined"; // at least one declined

export interface ApprovalTallyResult {
  status: ApprovalFinalStatus;
  mom: { decision: ApprovalDecision | null; votedAtIso: string | null };
  grandma: { decision: ApprovalDecision | null; votedAtIso: string | null };
  /** Adult-facing summary line for the planner UI. */
  adultLine: string;
  /** Kid-facing line — calm, never punitive. */
  kidLine: string;
  /** Pure side-effect-free flag the caller can use to decide whether to apply the change. */
  shouldApplyChange: boolean;
  /** Useful for analytics / audits — never used for blame. */
  ignoredVoteCount: number;
}

const MOM_EMAIL = "spear.cpt@gmail.com";
const GRANDMA_EMAIL = "marcy.spear@gmail.com";
const HARD_BLOCKED_EMAIL = "reagan.higgs33@ihsd.us";

function pickLatest(votes: ApprovalVote[]): ApprovalVote | null {
  if (votes.length === 0) return null;
  // Most recent vote wins if an adult changed their mind.
  return votes.slice().sort((a, b) => {
    const at = Date.parse(a.votedAtIso) || 0;
    const bt = Date.parse(b.votedAtIso) || 0;
    return bt - at;
  })[0];
}

export function tallyScheduleChangeApprovals(input: {
  votes: ApprovalVote[];
}): ApprovalTallyResult {
  const allVotes = Array.isArray(input.votes) ? input.votes : [];

  let ignoredVoteCount = 0;
  const momVotes: ApprovalVote[] = [];
  const grandmaVotes: ApprovalVote[] = [];

  for (const v of allVotes) {
    const email = (v.voterEmail ?? "").toLowerCase().trim();
    if (email === HARD_BLOCKED_EMAIL) {
      ignoredVoteCount += 1;
      continue;
    }
    if (email === MOM_EMAIL) {
      momVotes.push(v);
    } else if (email === GRANDMA_EMAIL) {
      grandmaVotes.push(v);
    } else {
      ignoredVoteCount += 1;
    }
  }

  const momLatest = pickLatest(momVotes);
  const grandmaLatest = pickLatest(grandmaVotes);

  const momDecision = momLatest?.decision ?? null;
  const grandmaDecision = grandmaLatest?.decision ?? null;

  let status: ApprovalFinalStatus = "pending";
  if (momDecision === "decline" || grandmaDecision === "decline") {
    status = "declined";
  } else if (momDecision === "approve" && grandmaDecision === "approve") {
    status = "approved";
  }

  let kidLine: string;
  let adultLine: string;
  switch (status) {
    case "approved":
      kidLine = "Mom and Grandma both said yes. Schedule's updating.";
      adultLine = "Both approvals received. Apply the change.";
      break;
    case "declined":
      kidLine =
        "Not this time — they didn't both agree. You can ask again later.";
      adultLine = "At least one decline recorded. Request closed.";
      break;
    case "pending":
    default: {
      const waiting: string[] = [];
      if (momDecision == null) waiting.push("Mom");
      if (grandmaDecision == null) waiting.push("Grandma");
      kidLine = `Still waiting on ${waiting.join(" and ")}.`;
      adultLine = `Awaiting ${waiting.join(" and ")} decision.`;
      break;
    }
  }

  return {
    status,
    mom: {
      decision: momDecision,
      votedAtIso: momLatest?.votedAtIso ?? null,
    },
    grandma: {
      decision: grandmaDecision,
      votedAtIso: grandmaLatest?.votedAtIso ?? null,
    },
    adultLine,
    kidLine,
    shouldApplyChange: status === "approved",
    ignoredVoteCount,
  };
}
