import { describe, it, expect } from "vitest";
import { checkKiwiQuietHours } from "./_lib/kiwiQuietHoursGate";

describe("kiwiQuietHoursGate — quiet-hours suppression for proactive Kiwi", () => {
  it("default window 21..7: 23:00 is quiet", () => {
    const r = checkKiwiQuietHours({ localHour: 23 });
    expect(r.isQuiet).toBe(true);
    expect(r.reason).toBe("in_quiet_window");
    expect(r.windowApplied).toEqual({ start: 21, end: 7 });
  });

  it("default window: 21 is the start boundary (quiet)", () => {
    const r = checkKiwiQuietHours({ localHour: 21 });
    expect(r.isQuiet).toBe(true);
  });

  it("default window: 20 is just before quiet (not quiet)", () => {
    const r = checkKiwiQuietHours({ localHour: 20 });
    expect(r.isQuiet).toBe(false);
    expect(r.reason).toBe("outside_window");
  });

  it("default window: 6 is quiet (still before end=7)", () => {
    expect(checkKiwiQuietHours({ localHour: 6 }).isQuiet).toBe(true);
  });

  it("default window: 7 is end boundary, NOT quiet (exclusive end)", () => {
    expect(checkKiwiQuietHours({ localHour: 7 }).isQuiet).toBe(false);
  });

  it("default window: midnight (0) and 1am are quiet", () => {
    expect(checkKiwiQuietHours({ localHour: 0 }).isQuiet).toBe(true);
    expect(checkKiwiQuietHours({ localHour: 1 }).isQuiet).toBe(true);
  });

  it("default window: noon, afternoon, early evening are not quiet", () => {
    for (const h of [8, 12, 16, 19]) {
      expect(checkKiwiQuietHours({ localHour: h }).isQuiet).toBe(false);
    }
  });

  it("non-wrapping custom window 1..5 catches 02, 04 but not 06", () => {
    expect(checkKiwiQuietHours({ localHour: 2, startHour: 1, endHour: 5 }).isQuiet).toBe(true);
    expect(checkKiwiQuietHours({ localHour: 4, startHour: 1, endHour: 5 }).isQuiet).toBe(true);
    expect(checkKiwiQuietHours({ localHour: 5, startHour: 1, endHour: 5 }).isQuiet).toBe(false);
    expect(checkKiwiQuietHours({ localHour: 6, startHour: 1, endHour: 5 }).isQuiet).toBe(false);
  });

  it("custom wrapping window 22..6 catches 23 and 5", () => {
    const w = { startHour: 22, endHour: 6 };
    expect(checkKiwiQuietHours({ localHour: 23, ...w }).isQuiet).toBe(true);
    expect(checkKiwiQuietHours({ localHour: 5, ...w }).isQuiet).toBe(true);
    expect(checkKiwiQuietHours({ localHour: 6, ...w }).isQuiet).toBe(false);
    expect(checkKiwiQuietHours({ localHour: 21, ...w }).isQuiet).toBe(false);
  });

  it("start === end means empty window (never quiet)", () => {
    expect(
      checkKiwiQuietHours({ localHour: 22, startHour: 22, endHour: 22 }).isQuiet,
    ).toBe(false);
  });

  it("invalid localHour fails safe (NOT quiet)", () => {
    const r1 = checkKiwiQuietHours({ localHour: NaN });
    expect(r1.isQuiet).toBe(false);
    expect(r1.reason).toBe("invalid_input");

    expect(checkKiwiQuietHours({ localHour: -1 }).isQuiet).toBe(false);
    expect(checkKiwiQuietHours({ localHour: 24 }).isQuiet).toBe(false);
    expect(checkKiwiQuietHours({ localHour: 100 }).isQuiet).toBe(false);
  });

  it("invalid startHour / endHour fall back to defaults", () => {
    const r = checkKiwiQuietHours({
      localHour: 23,
      startHour: -5,
      endHour: 99,
    });
    expect(r.windowApplied).toEqual({ start: 21, end: 7 });
    expect(r.isQuiet).toBe(true);
  });

  it("decimal hours are floored", () => {
    expect(checkKiwiQuietHours({ localHour: 21.99 }).isQuiet).toBe(true);
    expect(checkKiwiQuietHours({ localHour: 6.5 }).isQuiet).toBe(true);
    expect(checkKiwiQuietHours({ localHour: 7.1 }).isQuiet).toBe(false);
  });

  it("is deterministic — same input → same output", () => {
    const input = { localHour: 22 };
    expect(checkKiwiQuietHours(input)).toEqual(checkKiwiQuietHours(input));
  });

  it("non-quiet hour 14 in non-wrapping 10..15 window IS quiet", () => {
    expect(
      checkKiwiQuietHours({ localHour: 14, startHour: 10, endHour: 15 }).isQuiet,
    ).toBe(true);
  });
});
