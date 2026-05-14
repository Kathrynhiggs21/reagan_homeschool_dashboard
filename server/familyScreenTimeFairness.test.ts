import { describe, it, expect } from "vitest";
import { computeFamilyScreenTimeFairness } from "./_lib/familyScreenTimeFairness";

const ISO = "2026-05-15";

describe("Push 182 — Family screen-time fairness helper", () => {
  it("never blocks; blocked is always false", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 999 }],
    });
    expect(r.blocked).toBe(false);
  });

  it("always-allowed activities are surfaced first, every open", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 0 }],
    });
    expect(r.alwaysAllowedSurfaced.length).toBeGreaterThanOrEqual(5);
    expect(r.lines.filter((l) => l.kind === "always_allowed").length).toBe(5);
    // headline first
    expect(r.lines[0]?.kind).toBe("headline");
  });

  it("Mom override adds extra minutes", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 30 }],
      overrides: [{ grantedBy: "mom", extraMinutes: 20 }],
    });
    expect(r.reaganTotalAllowedMin).toBe(45 + 20);
    expect(r.reaganRemainingMin).toBe(35);
    expect(r.lines.find((l) => l.kind === "override_note")?.text).toMatch(/Mom/);
  });

  it("Grandma override is enough on its own (no agreement needed)", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 30 }],
      overrides: [{ grantedBy: "grandma", extraMinutes: 15, reason: "outside time finished" }],
    });
    expect(r.reaganTotalAllowedMin).toBe(60);
    expect(
      r.lines.find((l) => l.kind === "override_note")?.text,
    ).toMatch(/Grandma/);
  });

  it("fairness note appears only when reagan > family avg + 30", () => {
    const balanced = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "mom",
      usageToday: [
        { memberId: "reagan", minutes: 40 },
        { memberId: "mom", minutes: 35 },
      ],
    });
    expect(balanced.fairnessSuggested).toBe(false);

    const skewed = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "mom",
      usageToday: [
        { memberId: "reagan", minutes: 90 },
        { memberId: "mom", minutes: 10 },
      ],
    });
    expect(skewed.fairnessSuggested).toBe(true);
    expect(
      skewed.lines.find((l) => l.kind === "fairness_note")?.text,
    ).toMatch(/always-allowed/);
  });

  it("kid line and adult line never use punitive words", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 0 }],
    });
    for (const banned of ["lose", "lost", "punish", "bad", "fail"]) {
      expect(r.kidLine.toLowerCase()).not.toMatch(new RegExp(`\\b${banned}\\b`));
      expect(r.adultLine.toLowerCase()).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });

  it("bank carry-in from Roblox earn helper boosts allowance", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 0 }],
      bankCarriedMin: 30,
    });
    expect(r.reaganTotalAllowedMin).toBe(75);
  });

  it("kid headline is friendly and reads remaining minutes", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 10 }],
    });
    expect(r.lines[0]?.text).toMatch(/35 minutes/);
  });

  it("adult headline shows used + remaining", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "mom",
      usageToday: [{ memberId: "reagan", minutes: 20 }],
    });
    expect(r.lines[0]?.text).toMatch(/20 min used/);
    expect(r.lines[0]?.text).toMatch(/25 min left/);
  });

  it("custom always-allowed list is honored", () => {
    const r = computeFamilyScreenTimeFairness({
      isoDate: ISO,
      viewerId: "reagan",
      usageToday: [{ memberId: "reagan", minutes: 0 }],
      alwaysAllowed: [
        { key: "bird_watch", label: "Watch birds at the feeder", category: "outdoor" },
      ],
    });
    expect(r.alwaysAllowedSurfaced.length).toBe(1);
    expect(
      r.lines.find((l) => l.kind === "always_allowed")?.text,
    ).toBe("Watch birds at the feeder");
  });
});
