/**
 * Push 111 (2026-05-13) — Reagan request → approval routing helper.
 *
 * Pure decision module that takes a request Reagan sent (assignment idea,
 * adventure idea, schedule change) and returns:
 *   - whether it requires phone-push approvals at all
 *   - the recipient list (Mom + Grandma always; Dad if enabled)
 *   - the rendered SMS-ready summary line
 *
 * House rules from the project knowledge:
 *   - Reagan cannot directly change schedules; she requests them.
 *   - Schedule changes require approval from Mom *and* Grandma; both
 *     get a phone push.
 *   - Assignment + adventure requests notify Mom + Grandma but only
 *     require *one* approval (not unanimous). Mom is canonical approver;
 *     Grandma is FYI + secondary approver.
 *   - Empty body → reject pre-flight (do not enqueue).
 *   - Excessively long body (>500 chars) → trim with ellipsis for SMS.
 *   - sensitive content tags ("emergency", "hurt", "scared", "sick")
 *     mark `urgent: true` so the UI can surface a banner.
 *
 * Pure module, no DB, no I/O.
 */

export type ReaganRequestKind = "assignment" | "adventure" | "schedule-change";

export interface ReaganRequestInput {
  kind: ReaganRequestKind;
  body: string;
  /** Optional roster overrides; defaults below. */
  recipients?: {
    mom?: string;
    grandma?: string;
    dad?: string | null;
  };
}

export interface ApprovalRoutingPlan {
  ok: boolean;
  /** Why we rejected; only meaningful when ok=false. */
  rejectReason?: "empty-body" | "non-string-body" | "unknown-kind";
  recipients: ReadonlyArray<{ label: string; email: string; required: boolean }>;
  /** True iff Mom AND Grandma must both approve before the change applies. */
  requiresUnanimousApproval: boolean;
  /** SMS-style summary line (≤ 160 chars when possible). */
  smsLine: string;
  /** Heuristic urgency flag for UI banners. */
  urgent: boolean;
}

const DEFAULT_MOM_EMAIL = "spear.cpt@gmail.com";
const DEFAULT_GRANDMA_EMAIL = "marcy.spear@gmail.com";
const DEFAULT_DAD_EMAIL = "blakehiggs@hotmail.com";
const SMS_MAX = 160;

const URGENT_KEYWORDS = [
  "emergency",
  "hurt",
  "hurting",
  "scared",
  "sick",
  "throwing up",
  "bleeding",
];

function isLikelyUrgent(body: string): boolean {
  const lower = body.toLowerCase();
  return URGENT_KEYWORDS.some((k) => lower.includes(k));
}

function trimToSms(prefix: string, body: string): string {
  const room = SMS_MAX - prefix.length;
  const safe = body.length > room ? `${body.slice(0, Math.max(0, room - 1))}…` : body;
  return `${prefix}${safe}`;
}

export function planReaganRequestRouting(
  input: ReaganRequestInput,
): ApprovalRoutingPlan {
  // Body validation.
  if (typeof input.body !== "string") {
    return {
      ok: false,
      rejectReason: "non-string-body",
      recipients: [],
      requiresUnanimousApproval: false,
      smsLine: "",
      urgent: false,
    };
  }
  const body = input.body.trim();
  if (body.length === 0) {
    return {
      ok: false,
      rejectReason: "empty-body",
      recipients: [],
      requiresUnanimousApproval: false,
      smsLine: "",
      urgent: false,
    };
  }

  // Kind validation.
  if (
    input.kind !== "assignment" &&
    input.kind !== "adventure" &&
    input.kind !== "schedule-change"
  ) {
    return {
      ok: false,
      rejectReason: "unknown-kind",
      recipients: [],
      requiresUnanimousApproval: false,
      smsLine: "",
      urgent: false,
    };
  }

  // Build recipient list. Mom + Grandma always.
  const momEmail = input.recipients?.mom ?? DEFAULT_MOM_EMAIL;
  const grandmaEmail = input.recipients?.grandma ?? DEFAULT_GRANDMA_EMAIL;
  // Dad explicitly allowed via override; null means "skip Dad".
  const dadEmail =
    input.recipients?.dad === undefined
      ? DEFAULT_DAD_EMAIL
      : input.recipients?.dad;

  const recipients: Array<{ label: string; email: string; required: boolean }> = [];

  // Schedule changes need both Mom AND Grandma.
  const requiresUnanimousApproval = input.kind === "schedule-change";

  recipients.push({
    label: "Mom",
    email: momEmail,
    required: true,
  });
  recipients.push({
    label: "Grandma",
    email: grandmaEmail,
    required: requiresUnanimousApproval,
  });
  if (dadEmail) {
    // Dad is FYI for assignment/adventure; for schedule-change Dad is
    // still FYI (Mom + Grandma are the canonical pair).
    recipients.push({ label: "Dad", email: dadEmail, required: false });
  }

  // SMS prefix per kind.
  const prefix =
    input.kind === "assignment"
      ? "Reagan: assignment idea — "
      : input.kind === "adventure"
        ? "Reagan: adventure idea — "
        : "Reagan: SCHEDULE CHANGE request — ";

  return {
    ok: true,
    recipients,
    requiresUnanimousApproval,
    smsLine: trimToSms(prefix, body),
    urgent: isLikelyUrgent(body),
  };
}
