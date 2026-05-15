import { describe, it, expect } from "vitest";
import { deriveKiwiClockParts } from "./_lib/kiwiClockHelpers";

const HOUR = 60 * 60 * 1000;

describe("kiwiClockHelpers — utc ms + tz → localHour + dayIndex", () => {
  it("UTC noon stays noon under UTC", () => {
    const t = Date.UTC(2026, 4, 15, 12, 0, 0); // May 15 2026 12:00 UTC
    const p = deriveKiwiClockParts(t, "UTC");
    expect(p.localHour).toBe(12);
    expect(p.localYear).toBe(2026);
    expect(p.localMonth).toBe(5);
    expect(p.localDay).toBe(15);
    expect(p.timeZone).toBe("UTC");
  });

  it("America/New_York: UTC 16:00 → 12:00 local (EDT, May)", () => {
    const t = Date.UTC(2026, 4, 15, 16, 0, 0); // May 15 16:00 UTC
    const p = deriveKiwiClockParts(t, "America/New_York");
    expect(p.localHour).toBe(12);
    expect(p.localDay).toBe(15);
  });

  it("America/Los_Angeles: UTC 07:00 → 00:00 local (midnight, PDT)", () => {
    const t = Date.UTC(2026, 4, 15, 7, 0, 0); // May 15 07:00 UTC
    const p = deriveKiwiClockParts(t, "America/Los_Angeles");
    expect(p.localHour).toBe(0);
    expect(p.localDay).toBe(15);
  });

  it("Day rolls back: UTC 03:00 → previous day in America/Los_Angeles", () => {
    const t = Date.UTC(2026, 4, 15, 3, 0, 0); // May 15 03:00 UTC = May 14 20:00 PDT
    const p = deriveKiwiClockParts(t, "America/Los_Angeles");
    expect(p.localDay).toBe(14);
    expect(p.localHour).toBe(20);
  });

  it("dayIndex strictly increases day over day in same tz", () => {
    const a = deriveKiwiClockParts(Date.UTC(2026, 4, 15, 12), "UTC").dayIndex;
    const b = deriveKiwiClockParts(Date.UTC(2026, 4, 16, 12), "UTC").dayIndex;
    const c = deriveKiwiClockParts(Date.UTC(2026, 4, 17, 12), "UTC").dayIndex;
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
  });

  it("dayIndex is stable across hours of same local day", () => {
    const morning = deriveKiwiClockParts(Date.UTC(2026, 4, 15, 14), "America/New_York").dayIndex; // 10am local
    const evening = deriveKiwiClockParts(Date.UTC(2026, 4, 15, 23), "America/New_York").dayIndex; // 7pm local
    expect(morning).toBe(evening);
  });

  it("invalid timezone falls back to UTC", () => {
    const t = Date.UTC(2026, 4, 15, 12, 0, 0);
    const p = deriveKiwiClockParts(t, "Not/A_Real_Zone");
    expect(p.timeZone).toBe("UTC");
    expect(p.localHour).toBe(12);
  });

  it("empty timezone falls back to UTC", () => {
    const p = deriveKiwiClockParts(Date.UTC(2026, 4, 15, 12), "");
    expect(p.timeZone).toBe("UTC");
  });

  it("null/undefined timezone falls back to UTC", () => {
    const t = Date.UTC(2026, 4, 15, 12);
    expect(deriveKiwiClockParts(t, null).timeZone).toBe("UTC");
    expect(deriveKiwiClockParts(t, undefined).timeZone).toBe("UTC");
  });

  it("non-finite nowUtcMs coerces to epoch (0)", () => {
    const p = deriveKiwiClockParts(NaN, "UTC");
    expect(p.localYear).toBe(1970);
    expect(p.localMonth).toBe(1);
    expect(p.localDay).toBe(1);
  });

  it("negative nowUtcMs coerces to epoch (0)", () => {
    const p = deriveKiwiClockParts(-1, "UTC");
    expect(p.localYear).toBe(1970);
  });

  it("Asia/Tokyo: UTC 03:00 → 12:00 next day local", () => {
    const t = Date.UTC(2026, 4, 14, 15, 0, 0); // May 14 15:00 UTC = May 15 00:00 JST
    const p = deriveKiwiClockParts(t, "Asia/Tokyo");
    expect(p.localDay).toBe(15);
    expect(p.localHour).toBe(0);
  });

  it("DST spring-forward: 06:00 UTC → 02:00 EDT (after DST), same day", () => {
    // March 8, 2026 is DST spring-forward in US Eastern
    const t = Date.UTC(2026, 2, 8, 7, 0, 0); // 7:00 UTC = 03:00 EDT
    const p = deriveKiwiClockParts(t, "America/New_York");
    expect(p.localDay).toBe(8);
    expect(p.localHour).toBe(3);
  });

  it("is deterministic — same input → same output", () => {
    const t = Date.UTC(2026, 4, 15, 14);
    expect(deriveKiwiClockParts(t, "America/New_York")).toEqual(
      deriveKiwiClockParts(t, "America/New_York"),
    );
  });

  it("localHour is integer in 0..23 for every hour of a day in a real tz", () => {
    const base = Date.UTC(2026, 4, 15, 0, 0, 0);
    for (let i = 0; i < 24; i++) {
      const p = deriveKiwiClockParts(base + i * HOUR, "America/New_York");
      expect(Number.isInteger(p.localHour)).toBe(true);
      expect(p.localHour).toBeGreaterThanOrEqual(0);
      expect(p.localHour).toBeLessThanOrEqual(23);
    }
  });
});
