import { describe, expect, it } from "vitest";
import {
  KIWI_NUDGE_BLOCK_CAP,
  KIWI_NUDGE_COOLDOWN_MS,
  KIWI_NUDGE_DAILY_CAP,
  planKiwiIdleNudge,
  type KiwiNudgeContext,
} from "./_lib/kiwiIdleNudgeCooldown";

const baseCtx: KiwiNudgeContext = {
  nowMs: Date.UTC(2026, 4, 14, 14, 0, 0), // 14:00 UTC, but localHour passed below
  localHour: 10,
  isMorningVibeBlock: false,
  hasActiveBlock: true,
  inResetCountdown: false,
  kidDoNotDisturb: false,
  prior: { lastNudgeAtMs: null, blockNudgeCount: 0, dailyNudgeCount: 0 },
};

describe("Push 141 — Kiwi idle-nudge cooldown", () => {
  it("emits a gentle first nudge inside school hours", () => {
    const r = planKiwiIdleNudge(baseCtx);
    expect(r.suppressedReason).toBeNull();
    expect(r.nudge?.tier).toBe("gentle");
    expect(r.nudge?.nextEligibleAtMs).toBe(baseCtx.nowMs + KIWI_NUDGE_COOLDOWN_MS);
  });

  it("escalates to check-in then suggest-break across the same block", () => {
    const r2 = planKiwiIdleNudge({
      ...baseCtx,
      prior: { blockNudgeCount: 1, dailyNudgeCount: 1, lastNudgeAtMs: 0 },
    });
    expect(r2.nudge?.tier).toBe("check-in");
    const r3 = planKiwiIdleNudge({
      ...baseCtx,
      prior: { blockNudgeCount: 2, dailyNudgeCount: 2, lastNudgeAtMs: 0 },
    });
    expect(r3.nudge?.tier).toBe("suggest-break");
  });

  it("suppresses outside school hours", () => {
    const before = planKiwiIdleNudge({ ...baseCtx, localHour: 7 });
    expect(before.suppressedReason).toBe("outside-school-hours");
    const after = planKiwiIdleNudge({ ...baseCtx, localHour: 18 });
    expect(after.suppressedReason).toBe("outside-school-hours");
  });

  it("suppresses on the morning_vibe (Slay Charge) block", () => {
    const r = planKiwiIdleNudge({ ...baseCtx, isMorningVibeBlock: true });
    expect(r.suppressedReason).toBe("morning-vibe-block");
  });

  it("suppresses while reset countdown is on", () => {
    const r = planKiwiIdleNudge({ ...baseCtx, inResetCountdown: true });
    expect(r.suppressedReason).toBe("in-reset-countdown");
  });

  it("suppresses when kid taps do-not-disturb", () => {
    const r = planKiwiIdleNudge({ ...baseCtx, kidDoNotDisturb: true });
    expect(r.suppressedReason).toBe("kid-do-not-disturb");
  });

  it("suppresses when no active block", () => {
    const r = planKiwiIdleNudge({ ...baseCtx, hasActiveBlock: false });
    expect(r.suppressedReason).toBe("no-active-block");
  });

  it("suppresses while inside cooldown window", () => {
    const r = planKiwiIdleNudge({
      ...baseCtx,
      prior: {
        lastNudgeAtMs: baseCtx.nowMs - (KIWI_NUDGE_COOLDOWN_MS - 1),
        blockNudgeCount: 1,
        dailyNudgeCount: 1,
      },
    });
    expect(r.suppressedReason).toBe("cooldown-active");
  });

  it("re-eligible exactly at end of cooldown", () => {
    const r = planKiwiIdleNudge({
      ...baseCtx,
      prior: {
        lastNudgeAtMs: baseCtx.nowMs - KIWI_NUDGE_COOLDOWN_MS,
        blockNudgeCount: 1,
        dailyNudgeCount: 1,
      },
    });
    expect(r.nudge?.tier).toBe("check-in");
  });

  it("respects per-block cap", () => {
    const r = planKiwiIdleNudge({
      ...baseCtx,
      prior: {
        lastNudgeAtMs: 0,
        blockNudgeCount: KIWI_NUDGE_BLOCK_CAP,
        dailyNudgeCount: KIWI_NUDGE_BLOCK_CAP,
      },
    });
    expect(r.suppressedReason).toBe("block-cap-reached");
  });

  it("respects daily cap even when block cap not yet hit", () => {
    const r = planKiwiIdleNudge({
      ...baseCtx,
      prior: {
        lastNudgeAtMs: 0,
        blockNudgeCount: 0,
        dailyNudgeCount: KIWI_NUDGE_DAILY_CAP,
      },
    });
    expect(r.suppressedReason).toBe("daily-cap-reached");
  });

  it("clamps negative / non-finite counts to 0", () => {
    const r = planKiwiIdleNudge({
      ...baseCtx,
      prior: {
        lastNudgeAtMs: null,
        blockNudgeCount: -50 as any,
        dailyNudgeCount: Number.NaN as any,
      },
    });
    expect(r.nudge?.tier).toBe("gentle");
  });

  it("rejects on missing/invalid nowMs", () => {
    const r = planKiwiIdleNudge({ ...baseCtx, nowMs: Number.NaN as any });
    expect(r.suppressedReason).toBe("no-active-block");
  });
});
