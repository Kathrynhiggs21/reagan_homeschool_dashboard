/**
 * Push 137 (2026-05-13) — Spelling-practice deeplink + coin reward.
 *
 * Project rule: extra spelling practice is a "treatable to-do of school
 * time" — when Reagan completes an extra spelling round outside the
 * planned agenda, she earns coins. The reward is bounded so it can't be
 * grinded all day, and it must use the canonical Khan/IXL deeplink
 * (single source of truth — Push 116).
 *
 * Inputs:
 *   - subject: must be "spelling" (this helper only rewards spelling
 *     practice; other subjects get rewarded elsewhere)
 *   - listId / topic: lets one list pay out at most once per day
 *   - provider: "khan" | "ixl" (delegated to khanIxlDeeplink)
 *   - completionPercent: 0–100; needs ≥ 80 to count
 *   - alreadyAwardedListIdsToday: lists already paid out today
 *   - dailyExtraSpellingMinutesSoFar: caps at 30 min/day to keep it real
 *   - estimatedMinutes: helper's caller supplies the per-list estimate
 *
 * Reward:
 *   - 3 coins per qualifying completion
 *   - +1 bonus if completionPercent === 100
 *   - 0 coins (and "rejected") otherwise; the helper still returns the
 *     deeplink so the kid surface can let her practice for fun
 *
 * Pure module — no DB, no I/O.
 */

import {
  buildKhanIxlDeeplink,
  type CanonicalSubject,
  type DeeplinkPlan,
  type DeeplinkProvider,
} from "./khanIxlDeeplink";

export const SPELLING_REWARD_BASE_COINS = 3;
export const SPELLING_REWARD_PERFECT_BONUS = 1;
export const SPELLING_REWARD_MIN_PERCENT = 80;
export const SPELLING_REWARD_DAILY_MINUTES_CAP = 30;

export interface SpellingPracticeRewardInput {
  subject: CanonicalSubject;
  listId: string;
  topic?: string;
  provider: DeeplinkProvider;
  completionPercent: number;
  estimatedMinutes: number;
  alreadyAwardedListIdsToday?: ReadonlyArray<string>;
  dailyExtraSpellingMinutesSoFar?: number;
}

export type SpellingPracticeRewardDecision =
  | {
      grant: true;
      coins: number;
      reason: "granted" | "granted-perfect";
      deeplink: DeeplinkPlan;
      listId: string;
    }
  | {
      grant: false;
      reason:
        | "wrong-subject"
        | "missing-list-id"
        | "below-completion-threshold"
        | "already-awarded-today"
        | "daily-minutes-cap-reached"
        | "non-finite-input";
      deeplink: DeeplinkPlan | null;
      listId: string;
    };

function isFiniteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export function decideSpellingPracticeReward(
  input: SpellingPracticeRewardInput,
): SpellingPracticeRewardDecision {
  const listId = (input?.listId ?? "").trim();
  if (listId.length === 0) {
    return {
      grant: false,
      reason: "missing-list-id",
      deeplink: null,
      listId: "",
    };
  }

  // Always build a deeplink (kid can still practice for fun even when no
  // reward is granted). buildKhanIxlDeeplink returns a discriminated union;
  // unwrap to the plan or null so downstream callers always get a stable shape.
  const deeplinkResult = buildKhanIxlDeeplink({
    subject: input.subject,
    provider: input.provider,
    topic: input.topic,
  });
  const deeplink: DeeplinkPlan | null = deeplinkResult.ok
    ? deeplinkResult.plan
    : null;

  if (input.subject !== "spelling") {
    return { grant: false, reason: "wrong-subject", deeplink, listId };
  }
  if (
    !isFiniteNonNeg(input.completionPercent) ||
    !isFiniteNonNeg(input.estimatedMinutes)
  ) {
    return { grant: false, reason: "non-finite-input", deeplink, listId };
  }

  const minutesSoFar = isFiniteNonNeg(input.dailyExtraSpellingMinutesSoFar)
    ? (input.dailyExtraSpellingMinutesSoFar as number)
    : 0;
  if (minutesSoFar >= SPELLING_REWARD_DAILY_MINUTES_CAP) {
    return {
      grant: false,
      reason: "daily-minutes-cap-reached",
      deeplink,
      listId,
    };
  }

  const already = new Set(input.alreadyAwardedListIdsToday ?? []);
  if (already.has(listId)) {
    return { grant: false, reason: "already-awarded-today", deeplink, listId };
  }

  if (input.completionPercent < SPELLING_REWARD_MIN_PERCENT) {
    return {
      grant: false,
      reason: "below-completion-threshold",
      deeplink,
      listId,
    };
  }

  // If we got this far, subject === 'spelling', so deeplink should be
  // non-null (subject is canonical and provider was validated). Defend
  // against the unknown-provider branch by short-circuiting.
  if (deeplink == null) {
    return { grant: false, reason: "non-finite-input", deeplink: null, listId };
  }

  const perfect = input.completionPercent >= 100;
  const coins =
    SPELLING_REWARD_BASE_COINS + (perfect ? SPELLING_REWARD_PERFECT_BONUS : 0);

  return {
    grant: true,
    coins,
    reason: perfect ? "granted-perfect" : "granted",
    deeplink,
    listId,
  };
}
