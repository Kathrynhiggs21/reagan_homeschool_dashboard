/**
 * Push 108 (2026-05-13) — Sunday-only digest gating contract.
 *
 * All test moments are constructed from UTC + offset to America/New_York
 * so DST + non-DST cases are both pinned.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateSundayDigestGate,
  familyLocalDateOf,
  FAMILY_TIMEZONE,
  DIGEST_WINDOW_START_HOUR_LOCAL,
  DIGEST_WINDOW_END_HOUR_LOCAL,
  DIGEST_WINDOW_END_MINUTE_LOCAL,
} from "./_lib/sundayDigestGating";

// 2026-05-10 (Sunday) is currently EDT (UTC-4). 19:00 local = 23:00 UTC.
const SUN_19_00_EDT = new Date("2026-05-10T23:00:00Z");
const SUN_18_59_EDT = new Date("2026-05-10T22:59:00Z");
const SUN_20_30_EDT = new Date("2026-05-11T00:30:00Z");
const SUN_20_31_EDT = new Date("2026-05-11T00:31:00Z");
const MON_19_00_EDT = new Date("2026-05-11T23:00:00Z");
// 2026-01-04 (Sunday) is EST (UTC-5). 19:00 local = 00:00 UTC next day.
const SUN_19_00_EST = new Date("2026-01-05T00:00:00Z");

describe("Push 108 — Sunday-only digest gating", () => {
  it("FAMILY_TIMEZONE is America/New_York", () => {
    expect(FAMILY_TIMEZONE).toBe("America/New_York");
  });

  it("window constants form 19:00 → 20:30 family-local", () => {
    expect(DIGEST_WINDOW_START_HOUR_LOCAL).toBe(19);
    expect(DIGEST_WINDOW_END_HOUR_LOCAL).toBe(20);
    expect(DIGEST_WINDOW_END_MINUTE_LOCAL).toBe(30);
  });

  it("Sunday 19:00 EDT → allowed", () => {
    const r = evaluateSundayDigestGate({ now: SUN_19_00_EDT });
    expect(r.allow).toBe(true);
    if (r.allow) expect(r.reason).toBe("in-window-and-not-yet-sent");
  });

  it("Sunday 18:59 EDT → before-window", () => {
    const r = evaluateSundayDigestGate({ now: SUN_18_59_EDT });
    expect(r.allow).toBe(false);
    if (!r.allow) expect(r.reason).toBe("before-window");
  });

  it("Sunday 20:30 EDT → still allowed (inclusive end)", () => {
    const r = evaluateSundayDigestGate({ now: SUN_20_30_EDT });
    expect(r.allow).toBe(true);
  });

  it("Sunday 20:31 EDT → after-window", () => {
    const r = evaluateSundayDigestGate({ now: SUN_20_31_EDT });
    expect(r.allow).toBe(false);
    if (!r.allow) expect(r.reason).toBe("after-window");
  });

  it("Monday 19:00 EDT → not-sunday", () => {
    const r = evaluateSundayDigestGate({ now: MON_19_00_EDT });
    expect(r.allow).toBe(false);
    if (!r.allow) expect(r.reason).toBe("not-sunday");
  });

  it("Sunday 19:00 EST (winter, UTC-5) is correctly recognized", () => {
    const r = evaluateSundayDigestGate({ now: SUN_19_00_EST });
    expect(r.allow).toBe(true);
  });

  it("if lastSentAtIso falls on the same family-local date → already-sent-this-week", () => {
    const earlierSameSunday = new Date("2026-05-10T23:05:00Z").toISOString();
    const r = evaluateSundayDigestGate({
      now: SUN_19_00_EDT,
      lastSentAtIso: earlierSameSunday,
    });
    expect(r.allow).toBe(false);
    if (!r.allow) expect(r.reason).toBe("already-sent-this-week");
  });

  it("if lastSentAtIso is from a different Sunday → still allowed", () => {
    const lastWeek = new Date("2026-05-03T23:05:00Z").toISOString(); // prior Sun
    const r = evaluateSundayDigestGate({
      now: SUN_19_00_EDT,
      lastSentAtIso: lastWeek,
    });
    expect(r.allow).toBe(true);
  });

  it("invalid Date → invalid-now", () => {
    const r = evaluateSundayDigestGate({ now: new Date("not-a-date") });
    expect(r.allow).toBe(false);
    if (!r.allow) expect(r.reason).toBe("invalid-now");
  });

  it("familyLocalDateOf returns YYYY-MM-DD in family TZ", () => {
    expect(familyLocalDateOf(SUN_19_00_EDT)).toBe("2026-05-10");
    // 2026-01-05T00:00:00Z = 2026-01-04 19:00 EST
    expect(familyLocalDateOf(SUN_19_00_EST)).toBe("2026-01-04");
  });
});
