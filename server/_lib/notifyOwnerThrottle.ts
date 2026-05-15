/**
 * Wave-15 / Push 195 — notifyOwnerThrottle
 *
 * PURE deterministic helper. No I/O. Protects ALL notifyOwner calls
 * from accidental flooding when the dashboard fans out multiple
 * alerts in the same window. Per-category rolling 60-min cap.
 *
 * Safety bypass — never throttled:
 *   - category === "system_health"
 *   - category === "kid_login_help" AND kidEmail === blocked IHSD email
 */

export type NotifyCategory =
  | "kid_login_help"
  | "vault_rotation_due"
  | "screen_time_overage"
  | "weekly_digest"
  | "system_health"
  | "other";

export interface NotifyAttempt {
  category: NotifyCategory;
  isoTimestamp: string;
  wasFired: boolean;
  kidEmail?: string | null;
}

export interface ThrottleDecision {
  shouldFire: boolean;
  suppressedReason: string | null;
}

export interface ThrottleInput {
  attempts: NotifyAttempt[];
  nowIso: string;
  windowMs?: number;
  perCategoryCap?: number;
}

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_CAP = 4;
const BLOCKED_KID_EMAIL = "reagan.higgs33@ihsd.us";

function isBypass(latest: NotifyAttempt): boolean {
  if (latest.category === "system_health") return true;
  if (
    latest.category === "kid_login_help" &&
    latest.kidEmail === BLOCKED_KID_EMAIL
  ) {
    return true;
  }
  return false;
}

export function decideNotifyOwnerThrottle(input: ThrottleInput): ThrottleDecision {
  const { attempts, nowIso } = input;
  const windowMs = input.windowMs ?? DEFAULT_WINDOW_MS;
  const cap = input.perCategoryCap ?? DEFAULT_CAP;

  if (attempts.length === 0) {
    return { shouldFire: false, suppressedReason: "no attempts" };
  }
  const latest = attempts[attempts.length - 1];

  if (isBypass(latest)) {
    return { shouldFire: true, suppressedReason: null };
  }

  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) {
    return { shouldFire: true, suppressedReason: null };
  }

  let firedInWindow = 0;
  for (let i = 0; i < attempts.length - 1; i++) {
    const a = attempts[i];
    if (a.category !== latest.category) continue;
    if (!a.wasFired) continue;
    const t = Date.parse(a.isoTimestamp);
    if (!Number.isFinite(t)) continue;
    if (nowMs - t < windowMs) firedInWindow += 1;
  }

  if (firedInWindow >= cap) {
    return {
      shouldFire: false,
      suppressedReason: `${latest.category} cap reached (${firedInWindow}/${cap} in last ${Math.round(
        windowMs / 60000,
      )} min)`,
    };
  }

  return { shouldFire: true, suppressedReason: null };
}

export const __FOR_TEST__ = {
  DEFAULT_WINDOW_MS,
  DEFAULT_CAP,
  BLOCKED_KID_EMAIL,
  isBypass,
};
