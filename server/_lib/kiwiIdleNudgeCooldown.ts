/**
 * Push 141 (2026-05-14) — Kiwi idle-nudge cooldown helper.
 *
 * Kiwi is the on-page mascot/buddy who can pop a gentle nudge when Reagan
 * has been idle on a school block. To stay anxiety-safe, nudges must:
 *   - Respect a per-block + per-day rate limit (no spamming)
 *   - Stay quiet during the kid-facing 5-minute reset countdown (Push 122)
 *   - Stay quiet outside school hours (08:00–14:30 local)
 *   - Stay quiet on the Slay Charge ⚡ morning_vibe block (Push 118)
 *   - Stay quiet when Reagan has flagged "I'm working, leave me alone"
 *   - Escalate gently: gentle → check-in → suggest-break (after that, hold)
 *
 * Pure module: no DB, no I/O. Returns either {nudge: NudgePlan} when a nudge
 * is allowed, or {nudge: null, suppressedReason} when it should stay quiet.
 */

export type KiwiNudgeTier = "gentle" | "check-in" | "suggest-break";

export const KIWI_NUDGE_COOLDOWN_MS = 8 * 60_000; // 8 min between nudges per block
export const KIWI_NUDGE_DAILY_CAP = 6;
export const KIWI_NUDGE_BLOCK_CAP = 3;

export type KiwiSuppressedReason =
  | "outside-school-hours"
  | "morning-vibe-block"
  | "in-reset-countdown"
  | "kid-do-not-disturb"
  | "block-cap-reached"
  | "daily-cap-reached"
  | "cooldown-active"
  | "no-active-block";

export type KiwiNudgePriorActivity = {
  /** ms epoch UTC of the most recent nudge for this block (any tier). */
  lastNudgeAtMs?: number | null;
  /** Total nudges already shown for the *current* block today. */
  blockNudgeCount?: number | null;
  /** Total nudges already shown across the whole day. */
  dailyNudgeCount?: number | null;
};

export type KiwiNudgeContext = {
  /** ms epoch UTC of the moment we'd potentially nudge. */
  nowMs: number;
  /** Hour-of-day in family local timezone (0..23). Caller resolves TZ. */
  localHour: number;
  /** True when the active block is the Slay Charge ⚡ morning_vibe block. */
  isMorningVibeBlock: boolean;
  /** True when there is no active school block right now. */
  hasActiveBlock: boolean;
  /** True when the kid-facing 5-minute reset countdown (Push 122) is on. */
  inResetCountdown: boolean;
  /** True when Reagan has tapped "do not disturb" on the buddy. */
  kidDoNotDisturb: boolean;
  prior?: KiwiNudgePriorActivity | null;
};

export type KiwiNudgePlan = {
  tier: KiwiNudgeTier;
  message: string;
  /** ms epoch UTC after which the next nudge for this block becomes eligible. */
  nextEligibleAtMs: number;
};

export type KiwiNudgeDecision =
  | { nudge: KiwiNudgePlan; suppressedReason: null }
  | { nudge: null; suppressedReason: KiwiSuppressedReason };

const TIER_COPY: Record<KiwiNudgeTier, string> = {
  gentle: "Hey, still with me? Tap when you're ready 🐤",
  "check-in": "Stuck or just thinking? I can re-read the directions.",
  "suggest-break": "Want a 5-min reset? You can come back super fresh.",
};

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function pickTier(
  blockCountSoFar: number,
): KiwiNudgeTier {
  if (blockCountSoFar <= 0) return "gentle";
  if (blockCountSoFar === 1) return "check-in";
  return "suggest-break";
}

export function planKiwiIdleNudge(ctx: KiwiNudgeContext): KiwiNudgeDecision {
  if (!ctx || !isFiniteNum(ctx.nowMs)) {
    return { nudge: null, suppressedReason: "no-active-block" };
  }
  if (!ctx.hasActiveBlock) {
    return { nudge: null, suppressedReason: "no-active-block" };
  }
  // School-hours window: 08:00 inclusive .. 14:30 inclusive
  if (
    !isFiniteNum(ctx.localHour) ||
    ctx.localHour < 8 ||
    ctx.localHour > 14
  ) {
    return { nudge: null, suppressedReason: "outside-school-hours" };
  }
  if (ctx.isMorningVibeBlock) {
    return { nudge: null, suppressedReason: "morning-vibe-block" };
  }
  if (ctx.inResetCountdown) {
    return { nudge: null, suppressedReason: "in-reset-countdown" };
  }
  if (ctx.kidDoNotDisturb) {
    return { nudge: null, suppressedReason: "kid-do-not-disturb" };
  }

  const prior = ctx.prior ?? {};
  const blockCount = Math.max(0, Math.floor(prior.blockNudgeCount ?? 0));
  const dailyCount = Math.max(0, Math.floor(prior.dailyNudgeCount ?? 0));

  if (dailyCount >= KIWI_NUDGE_DAILY_CAP) {
    return { nudge: null, suppressedReason: "daily-cap-reached" };
  }
  if (blockCount >= KIWI_NUDGE_BLOCK_CAP) {
    return { nudge: null, suppressedReason: "block-cap-reached" };
  }

  if (
    isFiniteNum(prior.lastNudgeAtMs) &&
    prior.lastNudgeAtMs! > 0 &&
    ctx.nowMs - prior.lastNudgeAtMs! < KIWI_NUDGE_COOLDOWN_MS
  ) {
    return { nudge: null, suppressedReason: "cooldown-active" };
  }

  const tier = pickTier(blockCount);
  return {
    nudge: {
      tier,
      message: TIER_COPY[tier],
      nextEligibleAtMs: ctx.nowMs + KIWI_NUDGE_COOLDOWN_MS,
    },
    suppressedReason: null,
  };
}
