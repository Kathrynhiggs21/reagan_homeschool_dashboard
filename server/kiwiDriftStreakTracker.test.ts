import { describe, it, expect } from "vitest";
import {
  makeKiwiDriftStreakState,
  applyKiwiDriftEvent,
  readKiwiDriftStreak,
  resetKiwiDriftStreak,
} from "./_lib/kiwiDriftStreakTracker";

const TS = 1779000000000;

describe("kiwiDriftStreakTracker — per-panel drift streak", () => {
  it("empty state → streak 0 for any panel", () => {
    const s = makeKiwiDriftStreakState();
    expect(readKiwiDriftStreak(s, "today")).toBe(0);
    expect(readKiwiDriftStreak(s, "kiwi")).toBe(0);
  });

  it("first major event → streak 1, no fallback", () => {
    const r = applyKiwiDriftEvent(makeKiwiDriftStreakState(), {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r.currentStreak).toBe(1);
    expect(r.shouldUseBlessedFallback).toBe(false);
    expect(r.fallbackReason).toBe("");
  });

  it("two major events in a row → streak 2 + fallback fires", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r.currentStreak).toBe(2);
    expect(r.shouldUseBlessedFallback).toBe(true);
    expect(r.fallbackReason).toContain("today");
  });

  it("info severity resets streak to 0", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "info",
      timestampUtcMs: TS + 1,
    }).state;
    expect(readKiwiDriftStreak(state, "today")).toBe(0);
  });

  it("minor severity resets streak to 0 (it's not a fallback)", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "minor",
      timestampUtcMs: TS + 1,
    }).state;
    expect(readKiwiDriftStreak(state, "today")).toBe(0);
  });

  it("streaks are scoped per panel — A major + B major does NOT fire fallback", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r = applyKiwiDriftEvent(state, {
      panel: "kiwi",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r.shouldUseBlessedFallback).toBe(false);
    expect(readKiwiDriftStreak(r.state, "today")).toBe(1);
    expect(readKiwiDriftStreak(r.state, "kiwi")).toBe(1);
  });

  it("input state is not mutated (pure)", () => {
    const initial = makeKiwiDriftStreakState();
    initial.streakByPanel["today"] = 1;
    const before = JSON.stringify(initial);
    applyKiwiDriftEvent(initial, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(JSON.stringify(initial)).toBe(before);
  });

  it("null state input → starts from empty", () => {
    const r = applyKiwiDriftEvent(null, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r.currentStreak).toBe(1);
  });

  it("undefined state input → starts from empty", () => {
    const r = applyKiwiDriftEvent(undefined, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r.currentStreak).toBe(1);
  });

  it("non-finite timestamp coerced to 0", () => {
    const r = applyKiwiDriftEvent(makeKiwiDriftStreakState(), {
      panel: "today",
      severity: "major",
      timestampUtcMs: NaN,
    });
    expect(r.state.lastEventAtUtcMs.today).toBe(0);
  });

  it("empty / whitespace panel coerces to 'today'", () => {
    const r1 = applyKiwiDriftEvent(makeKiwiDriftStreakState(), {
      panel: "",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r1.state.streakByPanel.today).toBe(1);
    const r2 = applyKiwiDriftEvent(r1.state, {
      panel: "   ",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r2.state.streakByPanel.today).toBe(2);
  });

  it("panel lookup is case-insensitive", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "Today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r = applyKiwiDriftEvent(state, {
      panel: "TODAY",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r.shouldUseBlessedFallback).toBe(true);
  });

  it("three majors in a row → fallback stays true at streak 3", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    }).state;
    const r = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 2,
    });
    expect(r.currentStreak).toBe(3);
    expect(r.shouldUseBlessedFallback).toBe(true);
  });

  it("fallback reason contains no exclamation marks (adult-tone)", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r.fallbackReason).not.toContain("!");
  });

  it("fallback reason contains no emotional language", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r.fallbackReason).not.toMatch(
      /alarming|worrying|bad|terrible|great|amazing/i,
    );
  });

  it("fallback reason never mentions Reagan by name", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r.fallbackReason.toLowerCase()).not.toContain("reagan");
  });

  it("resetKiwiDriftStreak clears just one panel", () => {
    let state = makeKiwiDriftStreakState();
    state = applyKiwiDriftEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    state = applyKiwiDriftEvent(state, {
      panel: "kiwi",
      severity: "major",
      timestampUtcMs: TS + 1,
    }).state;
    const reset = resetKiwiDriftStreak(state, "today");
    expect(readKiwiDriftStreak(reset, "today")).toBe(0);
    expect(readKiwiDriftStreak(reset, "kiwi")).toBe(1);
  });

  it("non-plain state values are sanitized away", () => {
    const malformed = {
      streakByPanel: { today: "bad" as unknown as number, kiwi: -5 },
      lastEventAtUtcMs: { today: NaN as unknown as number },
    } as Parameters<typeof applyKiwiDriftEvent>[0];
    const r = applyKiwiDriftEvent(malformed, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r.currentStreak).toBe(1);
    expect(readKiwiDriftStreak(r.state, "kiwi")).toBe(0);
  });

  it("is deterministic — same input → same output", () => {
    const r1 = applyKiwiDriftEvent(makeKiwiDriftStreakState(), {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    const r2 = applyKiwiDriftEvent(makeKiwiDriftStreakState(), {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r1).toEqual(r2);
  });
});
