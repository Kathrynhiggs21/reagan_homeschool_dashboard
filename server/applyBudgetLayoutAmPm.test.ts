import { describe, it, expect } from "vitest";
import { applyBudgetLayout } from "./_lib/aiScheduleGenerator";

/**
 * Regression (2026-06-18): the nightly lesson generator calls
 * applyBudgetLayout with NO anchor startTime and NO budget. The old code
 * early-returned the blocks untouched, so an LLM AM/PM mixup (morning blocks
 * emitted as 22:xx) was persisted verbatim — that's how 6/18 ended up with
 * "Funny clip" at 22:00. The guard must normalize even on the no-anchor path.
 */
describe("applyBudgetLayout — AM/PM guard on the no-anchor path", () => {
  const draft = [
    { blockType: "morning_warmup", title: "Funny clip", durationMin: 10, startTime: "22:00" },
    { blockType: "math", title: "Measurement types", durationMin: 30, startTime: "22:10" },
    { blockType: "math", title: "Conversion intro", durationMin: 30, startTime: "22:40" },
    { blockType: "science", title: "Why water rolls off a duck", durationMin: 50, startTime: "23:10" },
    { blockType: "custom", title: "Lunch + reset", durationMin: 30, startTime: "12:00" },
    { blockType: "adventure", title: "3-Duck Adventure", durationMin: 40, startTime: "13:00" },
  ] as any[];

  it("repairs the corrupted leading morning run when no anchor/budget is given", () => {
    const out = applyBudgetLayout(draft, { startTime: null, minMinutes: null, maxMinutes: null });
    expect(out[0].startTime).toBe("10:00");
    expect(out[1].startTime).toBe("10:10");
    expect(out[2].startTime).toBe("10:40");
    expect(out[3].startTime).toBe("11:10");
  });

  it("leaves the already-correct afternoon untouched (split-day safety)", () => {
    const out = applyBudgetLayout(draft, { startTime: null, minMinutes: null, maxMinutes: null });
    expect(out[4].startTime).toBe("12:00");
    expect(out[5].startTime).toBe("13:00");
  });

  it("does nothing to a normal all-morning-start day", () => {
    const good = [
      { blockType: "morning_warmup", title: "Warm up", durationMin: 5, startTime: "08:30" },
      { blockType: "math", title: "Math", durationMin: 30, startTime: "08:35" },
    ] as any[];
    const out = applyBudgetLayout(good, { startTime: null, minMinutes: null, maxMinutes: null });
    expect(out[0].startTime).toBe("08:30");
    expect(out[1].startTime).toBe("08:35");
  });
});
