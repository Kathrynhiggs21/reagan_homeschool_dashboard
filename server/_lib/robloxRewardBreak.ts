/**
 * Push 135 (2026-05-13) — Roblox reward-break gating pure helper.
 *
 * Per project memory, Roblox is one of Reagan's preferred rewards/breaks. It
 * needs to feel like a real treat (not unlimited), and it must always cost
 * coins (not feathers / stickers — see project memory: reward units are
 * "coin" or "count"). It should also never derail school time.
 *
 * Rules locked in this helper:
 *   - Roblox break costs a fixed number of coins per minute requested.
 *   - There is a per-day max minutes budget Reagan cannot exceed.
 *   - There is a per-request max minute cap so a single ask can't burn the day.
 *   - There is a cooldown between two consecutive Roblox breaks so it doesn't
 *     turn into back-to-back sessions.
 *   - During school hours (Mon–Fri 09:00–15:00 in family TZ) Roblox is only
 *     allowed if the day's planned curriculum coverage is on-track or better
 *     (assessed by caller and passed in as `coverageOnTrack`); otherwise the
 *     break is deferred with reason "school-time-coverage-low".
 *   - Adult override (Mom or Grandma manually said yes) bypasses all gates
 *     except hard cost (you can't spend coins you don't have).
 *
 * Pure module — deterministic, no DB, no clock side effects (caller passes
 * `nowMs` and `lastBreakEndedAtMs`), so it's straightforward to unit-test.
 */

export const ROBLOX_COST_COINS_PER_MIN = 2;
export const ROBLOX_PER_REQUEST_MAX_MIN = 30;
export const ROBLOX_PER_DAY_MAX_MIN = 60;
export const ROBLOX_COOLDOWN_MIN = 45;
export const SCHOOL_HOURS_START_HOUR_LOCAL = 9;
export const SCHOOL_HOURS_END_HOUR_LOCAL = 15;
export const SCHOOL_TZ = "America/New_York";

export interface RobloxBreakRequest {
  /** Minutes Reagan asked for. */
  requestedMinutes: number;
  /** Coins Reagan currently has. */
  coinBalance: number;
  /** Minutes already spent on Roblox today (from coin-spend ledger). */
  minutesSpentTodayOnRoblox: number;
  /** Wall clock at request time (UTC ms). */
  nowMs: number;
  /** UTC ms her last Roblox break ended; null if none today. */
  lastBreakEndedAtMs: number | null;
  /** Caller-determined: is today's curriculum coverage on-track or better? */
  coverageOnTrack: boolean;
  /** Mom/Grandma manually said yes. Bypasses all gates except cost. */
  adultOverride?: boolean;
}

export type RobloxBreakDecision =
  | {
      grant: true;
      grantedMinutes: number;
      coinCost: number;
      reason: "granted" | "granted-adult-override";
    }
  | {
      grant: false;
      reason:
        | "non-positive-minutes"
        | "non-finite-input"
        | "exceeds-per-request-cap"
        | "exceeds-daily-budget"
        | "insufficient-coins"
        | "cooldown-active"
        | "school-time-coverage-low";
      detail?: string;
    };

function isFiniteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function inSchoolHours(nowMs: number): boolean {
  // Use Intl to extract local hour + weekday in family TZ. Pure given input.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    hour: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(nowMs));
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const wkPart = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number.parseInt(hourPart, 10);
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wkPart);
  return (
    isWeekday &&
    hour >= SCHOOL_HOURS_START_HOUR_LOCAL &&
    hour < SCHOOL_HOURS_END_HOUR_LOCAL
  );
}

export function decideRobloxRewardBreak(
  req: RobloxBreakRequest,
): RobloxBreakDecision {
  if (
    !isFiniteNonNeg(req.requestedMinutes) ||
    !isFiniteNonNeg(req.coinBalance) ||
    !isFiniteNonNeg(req.minutesSpentTodayOnRoblox) ||
    typeof req.nowMs !== "number" ||
    !Number.isFinite(req.nowMs)
  ) {
    return { grant: false, reason: "non-finite-input" };
  }
  const minutes = Math.floor(req.requestedMinutes);
  if (minutes <= 0) {
    return { grant: false, reason: "non-positive-minutes" };
  }
  const cost = minutes * ROBLOX_COST_COINS_PER_MIN;

  // Hard floor: even an adult override can't grant coins she doesn't have.
  if (req.coinBalance < cost) {
    return {
      grant: false,
      reason: "insufficient-coins",
      detail: `needs ${cost}, has ${Math.floor(req.coinBalance)}`,
    };
  }

  // Adult override skips all soft gates (per-request cap, daily budget,
  // cooldown, school-hours coverage). Cost still applies.
  if (req.adultOverride === true) {
    return {
      grant: true,
      grantedMinutes: minutes,
      coinCost: cost,
      reason: "granted-adult-override",
    };
  }

  if (minutes > ROBLOX_PER_REQUEST_MAX_MIN) {
    return {
      grant: false,
      reason: "exceeds-per-request-cap",
      detail: `max ${ROBLOX_PER_REQUEST_MAX_MIN} min per request`,
    };
  }

  if (
    req.minutesSpentTodayOnRoblox + minutes >
    ROBLOX_PER_DAY_MAX_MIN
  ) {
    return {
      grant: false,
      reason: "exceeds-daily-budget",
      detail: `daily cap ${ROBLOX_PER_DAY_MAX_MIN} min, already used ${Math.floor(
        req.minutesSpentTodayOnRoblox,
      )}`,
    };
  }

  if (req.lastBreakEndedAtMs != null && Number.isFinite(req.lastBreakEndedAtMs)) {
    const sinceMin = (req.nowMs - req.lastBreakEndedAtMs) / 60_000;
    if (sinceMin < ROBLOX_COOLDOWN_MIN) {
      const wait = Math.ceil(ROBLOX_COOLDOWN_MIN - sinceMin);
      return {
        grant: false,
        reason: "cooldown-active",
        detail: `wait ${wait} more min`,
      };
    }
  }

  if (inSchoolHours(req.nowMs) && !req.coverageOnTrack) {
    return {
      grant: false,
      reason: "school-time-coverage-low",
      detail: "finish today's planned coverage first",
    };
  }

  return {
    grant: true,
    grantedMinutes: minutes,
    coinCost: cost,
    reason: "granted",
  };
}
