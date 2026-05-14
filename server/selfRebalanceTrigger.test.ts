import { describe, it, expect } from "vitest";
import {
  decideSelfRebalance,
  type DayLiveSignals,
} from "./_lib/selfRebalanceTrigger";

const PLANNED = "2026-05-14T09:00:00Z";

function base(overrides: Partial<DayLiveSignals> = {}): DayLiveSignals {
  return {
    nowISO: "2026-05-14T10:30:00Z",
    plannedStartISO: PLANNED,
    actualStartISO: "2026-05-14T09:00:00Z",
    cumulativeOverrunMin: 0,
    moodBand: "great",
    lastRebalanceISO: null,
    ...overrides,
  };
}

describe("Push 160 — decideSelfRebalance", () => {
  it("on-track day: should NOT rebalance, reason kid-readable", () => {
    const r = decideSelfRebalance(base());
    expect(r.shouldRebalance).toBe(false);
    expect(r.triggerCodes).toEqual(["no_signal"]);
    expect(r.kidReadableReason.toLowerCase()).toContain("on track");
  });

  it("late start ≥ 10 min triggers rebalance", () => {
    const r = decideSelfRebalance(
      base({ actualStartISO: "2026-05-14T09:15:00Z" }),
    );
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toContain("late_start");
    expect(r.kidReadableReason).toMatch(/15 min late/);
  });

  it("over-run ≥ 15 min triggers rebalance", () => {
    const r = decideSelfRebalance(base({ cumulativeOverrunMin: 20 }));
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toContain("over_run");
    expect(r.kidReadableReason).toMatch(/20 min long/);
  });

  it("mood = tired triggers rebalance", () => {
    const r = decideSelfRebalance(base({ moodBand: "tired" }));
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toContain("mood_tired");
    expect(r.kidReadableReason.toLowerCase()).toContain("tired");
  });

  it("mood = frustrated triggers rebalance", () => {
    const r = decideSelfRebalance(base({ moodBand: "frustrated" }));
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toContain("mood_frustrated");
    expect(r.kidReadableReason.toLowerCase()).toContain("frustrated");
  });

  it("force button bypasses cooldown", () => {
    const r = decideSelfRebalance(
      base({
        forceRebalance: true,
        lastRebalanceISO: "2026-05-14T10:20:00Z", // 10 min ago
      }),
    );
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toContain("force_button");
    expect(r.kidReadableReason.toLowerCase()).toContain("mom or grandma");
  });

  it("inside cooldown blocks even strong signals", () => {
    const r = decideSelfRebalance(
      base({
        moodBand: "frustrated",
        cumulativeOverrunMin: 30,
        lastRebalanceISO: "2026-05-14T10:15:00Z", // 15 min ago
      }),
    );
    expect(r.shouldRebalance).toBe(false);
    expect(r.triggerCodes).toEqual(["cooldown_active"]);
    expect(r.kidReadableReason.toLowerCase()).toContain("just changed");
  });

  it("just past cooldown allows rebalance again", () => {
    const r = decideSelfRebalance(
      base({
        moodBand: "frustrated",
        nowISO: "2026-05-14T11:00:00Z",
        lastRebalanceISO: "2026-05-14T10:25:00Z", // 35 min ago
      }),
    );
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toContain("mood_frustrated");
  });

  it("rebalancerInput is in the shape dayTimelineRebalancer expects", () => {
    const r = decideSelfRebalance(
      base({ cumulativeOverrunMin: 18.4 }),
    );
    expect(r.rebalancerInput).toEqual({
      nowISO: "2026-05-14T10:30:00Z",
      plannedStartISO: PLANNED,
      actualStartISO: "2026-05-14T09:00:00Z",
      cumulativeOverrunMin: 18,
      moodBand: "great",
    });
  });

  it("late-start path uses nowISO when actualStartISO is null", () => {
    const r = decideSelfRebalance(
      base({
        actualStartISO: null,
        nowISO: "2026-05-14T09:20:00Z",
      }),
    );
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toContain("late_start");
  });

  it("multiple triggers are all reported", () => {
    const r = decideSelfRebalance(
      base({
        actualStartISO: "2026-05-14T09:30:00Z",
        cumulativeOverrunMin: 25,
        moodBand: "tired",
      }),
    );
    expect(r.shouldRebalance).toBe(true);
    expect(r.triggerCodes).toEqual(
      expect.arrayContaining(["late_start", "over_run", "mood_tired"]),
    );
  });

  it("rejects bad ISO timestamps loudly", () => {
    expect(() =>
      decideSelfRebalance(base({ nowISO: "not-a-date" })),
    ).toThrow(/ISO-8601/);
  });

  it("clamps negative over-run to 0", () => {
    const r = decideSelfRebalance(base({ cumulativeOverrunMin: -50 }));
    expect(r.shouldRebalance).toBe(false);
    expect(r.rebalancerInput.cumulativeOverrunMin).toBe(0);
  });
});
