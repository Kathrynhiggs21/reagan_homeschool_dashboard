/**
 * Push 135 (2026-05-13) — Roblox reward-break gating contract.
 *
 * Pins:
 *   - cost is 2 coins/min (locked exported constant)
 *   - non-positive / non-finite minutes rejected
 *   - per-request cap enforced (30 min)
 *   - per-day budget enforced (60 min)
 *   - insufficient coins is a hard floor (adult override can NOT bypass cost)
 *   - cooldown of 45 min between two consecutive breaks
 *   - during school hours (Mon–Fri 09–15 ET) Roblox blocked unless coverage on-track
 *   - outside school hours coverage flag is irrelevant
 *   - adult override bypasses cap / budget / cooldown / school-hours gate (but still pays)
 *   - granted decision returns coinCost = minutes * 2
 */
import { describe, it, expect } from "vitest";
import {
  ROBLOX_COST_COINS_PER_MIN,
  ROBLOX_PER_REQUEST_MAX_MIN,
  ROBLOX_PER_DAY_MAX_MIN,
  ROBLOX_COOLDOWN_MIN,
  decideRobloxRewardBreak,
} from "./_lib/robloxRewardBreak";

// 2026-05-13 is a Wednesday in America/New_York. We pick a few wall-clock
// anchors expressed as UTC ms so the helper's TZ logic is exercised.
const SCHOOL_HOURS_ET_WED = Date.parse("2026-05-13T15:00:00Z"); // 11:00 EDT (Wed)
const AFTER_SCHOOL_ET_WED = Date.parse("2026-05-13T22:00:00Z"); // 18:00 EDT (Wed)
const SATURDAY_ET = Date.parse("2026-05-16T15:00:00Z"); // 11:00 EDT (Sat)

describe("Push 135 — decideRobloxRewardBreak", () => {
  it("locks the published constants (cost 2, per-req 30, per-day 60, cooldown 45)", () => {
    expect(ROBLOX_COST_COINS_PER_MIN).toBe(2);
    expect(ROBLOX_PER_REQUEST_MAX_MIN).toBe(30);
    expect(ROBLOX_PER_DAY_MAX_MIN).toBe(60);
    expect(ROBLOX_COOLDOWN_MIN).toBe(45);
  });

  it("grants a normal after-school request: 20 min costs 40 coins", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 20,
      coinBalance: 100,
      minutesSpentTodayOnRoblox: 0,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(true);
    if (out.grant) {
      expect(out.grantedMinutes).toBe(20);
      expect(out.coinCost).toBe(40);
      expect(out.reason).toBe("granted");
    }
  });

  it("rejects non-positive minutes", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 0,
      coinBalance: 100,
      minutesSpentTodayOnRoblox: 0,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("non-positive-minutes");
  });

  it("rejects non-finite minutes", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: NaN,
      coinBalance: 100,
      minutesSpentTodayOnRoblox: 0,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("non-finite-input");
  });

  it("rejects requests over the per-request cap", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 31,
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 0,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("exceeds-per-request-cap");
  });

  it("rejects requests that would burst the daily budget", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 30,
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 45, // 45 + 30 = 75 > 60
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("exceeds-daily-budget");
  });

  it("rejects when coin balance is below cost", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 20,
      coinBalance: 10, // needs 40
      minutesSpentTodayOnRoblox: 0,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("insufficient-coins");
  });

  it("enforces the cooldown between breaks", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 15,
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 15,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: AFTER_SCHOOL_ET_WED - 10 * 60_000, // 10 min ago
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("cooldown-active");
  });

  it("clears the cooldown after 45 min", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 15,
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 15,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: AFTER_SCHOOL_ET_WED - 60 * 60_000,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(true);
  });

  it("during school hours blocks when coverage is NOT on-track", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 10,
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 0,
      nowMs: SCHOOL_HOURS_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: false,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("school-time-coverage-low");
  });

  it("during school hours allows when coverage IS on-track", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 10,
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 0,
      nowMs: SCHOOL_HOURS_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
    });
    expect(out.grant).toBe(true);
  });

  it("on weekends coverage flag is ignored (Saturday 11am ET passes with coverageOnTrack=false)", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 10,
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 0,
      nowMs: SATURDAY_ET,
      lastBreakEndedAtMs: null,
      coverageOnTrack: false,
    });
    expect(out.grant).toBe(true);
  });

  it("adult override bypasses cap / daily budget / cooldown / school-time gate", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 90, // way over per-request cap
      coinBalance: 999,
      minutesSpentTodayOnRoblox: 55, // would burst budget normally
      nowMs: SCHOOL_HOURS_ET_WED, // school hours
      lastBreakEndedAtMs: SCHOOL_HOURS_ET_WED - 5 * 60_000, // cooldown active
      coverageOnTrack: false,
      adultOverride: true,
    });
    expect(out.grant).toBe(true);
    if (out.grant) {
      expect(out.reason).toBe("granted-adult-override");
      expect(out.grantedMinutes).toBe(90);
      expect(out.coinCost).toBe(180);
    }
  });

  it("adult override does NOT bypass insufficient coins (hard floor)", () => {
    const out = decideRobloxRewardBreak({
      requestedMinutes: 30,
      coinBalance: 5, // needs 60
      minutesSpentTodayOnRoblox: 0,
      nowMs: AFTER_SCHOOL_ET_WED,
      lastBreakEndedAtMs: null,
      coverageOnTrack: true,
      adultOverride: true,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("insufficient-coins");
  });
});
