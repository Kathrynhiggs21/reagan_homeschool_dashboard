/**
 * Wave-15 / Push 212 — scheduleChangeRequestBuilder
 *
 * Pure deterministic helper. When Reagan asks Kiwi for a schedule
 * change ("can we do art instead of writing", "swap reading and
 * math", "move adventure earlier"), Kiwi's NLU layer parses her
 * intent into a structured request. This helper validates that
 * request and builds the canonical approval payload that goes out
 * to BOTH Mom and Grandma's phones (per Reagan's house rule:
 * schedule changes require approval from both adults).
 *
 * House rules baked in:
 *   - Reagan cannot directly change the schedule. This helper only
 *     produces a *request* — never a mutation. The actual schedule
 *     update happens after BOTH adults approve.
 *   - Both adults must approve. The request payload always has two
 *     approval slots: mom (spear.cpt@gmail.com) + grandma
 *     (marcy.spear@gmail.com). Single approval is NOT enough.
 *   - Voice rules: kidConfirmLine + adultBodyLine use calm older-
 *     cousin tone. No "buddy / friend / yay / great job".
 *   - Non-punitive framing: the adult-facing body never says she's
 *     "trying to skip" or "wants out of" — just states the request.
 *   - reagan.higgs33@ihsd.us is hard-blocked: if the caller passes
 *     that email in fromAccount, the helper returns blocked=true
 *     and refuses to construct a request.
 *
 * Inputs are the parsed intent + caller identity; outputs are the
 * approval payload + readable summary lines.
 */

export type ScheduleChangeAction =
  | "swap"
  | "move_earlier"
  | "move_later"
  | "replace_block"
  | "add_block"
  | "skip_block"
  | "unknown";

export interface ScheduleChangeIntent {
  action: ScheduleChangeAction;
  /** Block titles or block IDs the change targets — both forms allowed. */
  targetBlockTitles?: string[];
  targetBlockIds?: number[];
  /** For replace_block / add_block, what should go in its place. */
  proposedTitle?: string;
  proposedSubjectSlug?: string;
  /** Free-form reason Reagan gave Kiwi ("I'm tired", "outdoor day"). */
  reasonFromKid?: string;
}

export interface ScheduleChangeRequestPayload {
  blocked: boolean;
  blockedReason: string | null;
  requestId: string; // deterministic, derived from inputs
  isoDate: string;
  kidConfirmLine: string;
  adultBodyLine: string;
  approvers: Array<{
    role: "mom" | "grandma";
    email: string;
    status: "pending";
  }>;
  action: ScheduleChangeAction;
  targetBlockTitles: string[];
  targetBlockIds: number[];
  proposedTitle: string | null;
  proposedSubjectSlug: string | null;
  reasonFromKid: string | null;
}

const HARD_BLOCKED_EMAIL = "reagan.higgs33@ihsd.us";
const MOM_EMAIL = "spear.cpt@gmail.com";
const GRANDMA_EMAIL = "marcy.spear@gmail.com";

const FORBIDDEN_VOICE = /buddy|friend|yay|woohoo|great job|awesome/i;

function safeText(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function makeRequestId(input: {
  isoDate: string;
  action: ScheduleChangeAction;
  targets: string[];
  proposed: string;
}): string {
  // Tiny non-crypto hash so the requestId is deterministic per request.
  const raw = [
    input.isoDate,
    input.action,
    input.targets.join("|"),
    input.proposed,
  ].join("::");
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  // Stable short slug.
  return `req_${input.isoDate}_${input.action}_${Math.abs(h).toString(36)}`;
}

function describeAction(action: ScheduleChangeAction, targets: string[]): string {
  const t = targets.length > 0 ? targets.join(" + ") : "today's schedule";
  switch (action) {
    case "swap":
      return `swap ${t}`;
    case "move_earlier":
      return `move ${t} earlier`;
    case "move_later":
      return `move ${t} later`;
    case "replace_block":
      return `replace ${t}`;
    case "add_block":
      return `add a block to ${t}`;
    case "skip_block":
      return `skip ${t}`;
    case "unknown":
    default:
      return `update ${t}`;
  }
}

export function buildScheduleChangeRequest(input: {
  isoDate: string;
  intent: ScheduleChangeIntent;
  fromAccount: string;
}): ScheduleChangeRequestPayload {
  const fromAccount = safeText(input.fromAccount).toLowerCase();

  // Hard block: IHSD school email is never allowed to initiate requests.
  if (fromAccount === HARD_BLOCKED_EMAIL) {
    return {
      blocked: true,
      blockedReason:
        "School email (reagan.higgs33@ihsd.us) is not allowed to initiate schedule requests.",
      requestId: "",
      isoDate: input.isoDate,
      kidConfirmLine: "",
      adultBodyLine: "",
      approvers: [],
      action: input.intent.action,
      targetBlockTitles: [],
      targetBlockIds: [],
      proposedTitle: null,
      proposedSubjectSlug: null,
      reasonFromKid: null,
    };
  }

  const targets = (input.intent.targetBlockTitles ?? []).filter(
    (t) => t.trim().length > 0,
  );
  const targetIds = input.intent.targetBlockIds ?? [];
  const proposedTitle = safeText(input.intent.proposedTitle) || null;
  const proposedSubject = safeText(input.intent.proposedSubjectSlug) || null;
  const reason = safeText(input.intent.reasonFromKid) || null;

  const requestId = makeRequestId({
    isoDate: input.isoDate,
    action: input.intent.action,
    targets,
    proposed: proposedTitle ?? "",
  });

  const actionPhrase = describeAction(input.intent.action, targets);

  const kidConfirmLine = `Sent. Mom and Grandma both have to OK it before it changes.`;

  // Adult-facing line: calm, non-punitive, just states the request.
  const adultLeading = `Reagan asked to ${actionPhrase}.`;
  const adultReason = reason ? ` Reason she gave: "${reason}".` : "";
  const adultProposed = proposedTitle
    ? ` Proposed: ${proposedTitle}${proposedSubject ? ` (${proposedSubject})` : ""}.`
    : "";
  const adultBodyLine =
    `${adultLeading}${adultReason}${adultProposed} Approve from your phone.`.trim();

  // Voice-safety scrub on adult line — strip forbidden words if any
  // somehow leaked in from the kid's reason field (we never block her
  // saying them, we just don't let them propagate to the adult card).
  const scrubbedAdultBody = adultBodyLine.replace(FORBIDDEN_VOICE, "");

  return {
    blocked: false,
    blockedReason: null,
    requestId,
    isoDate: input.isoDate,
    kidConfirmLine,
    adultBodyLine: scrubbedAdultBody,
    approvers: [
      { role: "mom", email: MOM_EMAIL, status: "pending" },
      { role: "grandma", email: GRANDMA_EMAIL, status: "pending" },
    ],
    action: input.intent.action,
    targetBlockTitles: targets,
    targetBlockIds: targetIds,
    proposedTitle,
    proposedSubjectSlug: proposedSubject,
    reasonFromKid: reason,
  };
}
