import { describe, it, expect } from "vitest";
import { decideTutorSuppression } from "./_lib/tutorOfDay";

/**
 * "No tutors this summer" gate (2026-06-18) — pure decision tests.
 *
 * decideTutorSuppression is a pure function over the flat app-settings KV, so
 * these tests never touch the shared app_settings table (which would race the
 * sibling summer-mode planner integration tests that run in parallel).
 *
 * It must:
 *   - suppress tutors on dates summer mode considers active (default window)
 *   - NOT suppress during the school year
 *   - honor the tutors.suppressInSummer kill switch ("0"/"off" → never suppress)
 *   - respect Mom's manual summer override ("off" → school day even in July)
 *   - default the kill switch ON when the key is absent
 */
const DEFAULTS = {
  "summer.autoFlipEnabled": "1",
  "summer.start": "06-06",
  "summer.end": "08-15",
  "summer.override": "",
  "summer.vacationRanges": "",
};

describe("tutor summer suppression (pure decision)", () => {
  it("suppresses tutors on a summer date (July 10)", () => {
    expect(
      decideTutorSuppression("2026-07-10", { ...DEFAULTS, "tutors.suppressInSummer": "1" }),
    ).toBe(true);
  });

  it("does NOT suppress during the school year (Oct 1)", () => {
    expect(
      decideTutorSuppression("2026-10-01", { ...DEFAULTS, "tutors.suppressInSummer": "1" }),
    ).toBe(false);
  });

  it("does NOT suppress the day before summer (Jun 5)", () => {
    expect(
      decideTutorSuppression("2026-06-05", { ...DEFAULTS, "tutors.suppressInSummer": "1" }),
    ).toBe(false);
  });

  it("suppresses on the first summer day (Jun 6)", () => {
    expect(
      decideTutorSuppression("2026-06-06", { ...DEFAULTS, "tutors.suppressInSummer": "1" }),
    ).toBe(true);
  });

  it("kill switch '0' disables suppression even in summer", () => {
    expect(
      decideTutorSuppression("2026-07-10", { ...DEFAULTS, "tutors.suppressInSummer": "0" }),
    ).toBe(false);
  });

  it("kill switch 'off' also disables suppression", () => {
    expect(
      decideTutorSuppression("2026-07-10", { ...DEFAULTS, "tutors.suppressInSummer": "off" }),
    ).toBe(false);
  });

  it("defaults the kill switch ON when the key is absent", () => {
    expect(decideTutorSuppression("2026-07-10", { ...DEFAULTS })).toBe(true);
  });

  it("manual summer override 'off' forces a school day (no suppression)", () => {
    expect(
      decideTutorSuppression("2026-07-10", {
        ...DEFAULTS,
        "tutors.suppressInSummer": "1",
        "summer.override": "off",
      }),
    ).toBe(false);
  });

  it("declared vacation range during summer is treated as school-off, not suppressed", () => {
    // Vacation ranges make summer INACTIVE (reason: 'vacation'), so tutors are
    // not summer-suppressed on those days.
    expect(
      decideTutorSuppression("2026-07-10", {
        ...DEFAULTS,
        "tutors.suppressInSummer": "1",
        "summer.vacationRanges": JSON.stringify([{ start: "2026-07-08", end: "2026-07-15" }]),
      }),
    ).toBe(false);
  });
});
