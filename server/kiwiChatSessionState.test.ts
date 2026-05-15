import { describe, it, expect } from "vitest";
import {
  makeKiwiChatSessionState,
  applyKiwiChatSessionEvent,
  peekKiwiChatSessionSeed,
} from "./_lib/kiwiChatSessionState";

const TS = 1779000000000;

describe("kiwiChatSessionState — unified streak + rotation bundle", () => {
  it("empty state → both halves empty", () => {
    const s = makeKiwiChatSessionState();
    expect(s.streak.streakByPanel).toEqual({});
    expect(s.rotation.counterByPanel).toEqual({});
  });

  it("one major event → streak +1, rotation NOT advanced, no fallback", () => {
    const r = applyKiwiChatSessionEvent(makeKiwiChatSessionState(), {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r.state.streak.streakByPanel.today).toBe(1);
    expect(r.state.rotation.counterByPanel.today ?? 0).toBe(0);
    expect(r.shouldUseBlessedFallback).toBe(false);
    expect(r.rotationSeedForBlessedPick).toBe(0);
  });

  it("two majors → streak 2 + rotation +1 + fallback fires + seed returned", () => {
    let state = makeKiwiChatSessionState();
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r.shouldUseBlessedFallback).toBe(true);
    expect(r.state.streak.streakByPanel.today).toBe(2);
    expect(r.state.rotation.counterByPanel.today).toBe(1);
    expect(r.rotationSeedForBlessedPick).toBe(1);
  });

  it("rotation seed increments each consecutive blessed fallback", () => {
    let state = makeKiwiChatSessionState();
    // Build to streak 2 on `today` and fire one fallback
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    const r1 = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    });
    expect(r1.rotationSeedForBlessedPick).toBe(1);
    // Another major while still at threshold → rotation bumps again
    const r2 = applyKiwiChatSessionEvent(r1.state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 2,
    });
    expect(r2.rotationSeedForBlessedPick).toBe(2);
    expect(r2.state.streak.streakByPanel.today).toBe(3);
    expect(r2.state.rotation.counterByPanel.today).toBe(2);
  });

  it("clean reply resets streak; rotation untouched", () => {
    let state = makeKiwiChatSessionState();
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    }).state; // rotation now 1
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "info",
      timestampUtcMs: TS + 2,
    }).state;
    expect(state.streak.streakByPanel.today).toBe(0);
    expect(state.rotation.counterByPanel.today).toBe(1); // preserved
  });

  it("streaks + rotations are per-panel", () => {
    let state = makeKiwiChatSessionState();
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    }).state; // today fallback fires; today rotation = 1
    const r = applyKiwiChatSessionEvent(state, {
      panel: "kiwi",
      severity: "major",
      timestampUtcMs: TS + 2,
    });
    expect(r.shouldUseBlessedFallback).toBe(false);
    expect(r.state.rotation.counterByPanel.kiwi ?? 0).toBe(0);
    expect(r.state.rotation.counterByPanel.today).toBe(1);
  });

  it("input state never mutated", () => {
    const prev = makeKiwiChatSessionState();
    prev.streak.streakByPanel.today = 1;
    prev.rotation.counterByPanel.today = 7;
    const snap = JSON.stringify(prev);
    applyKiwiChatSessionEvent(prev, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(JSON.stringify(prev)).toBe(snap);
  });

  it("null + undefined prior state handled (starts from empty)", () => {
    const r1 = applyKiwiChatSessionEvent(null, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r1.state.streak.streakByPanel.today).toBe(1);
    const r2 = applyKiwiChatSessionEvent(undefined, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r2.state.streak.streakByPanel.today).toBe(1);
  });

  it("peekKiwiChatSessionSeed reports rotation counter without advancing", () => {
    let state = makeKiwiChatSessionState();
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS + 1,
    }).state;
    expect(peekKiwiChatSessionSeed(state, "today")).toBe(1);
    expect(peekKiwiChatSessionSeed(state, "TODAY")).toBe(1);
    expect(peekKiwiChatSessionSeed(state, "kiwi")).toBe(0);
    expect(peekKiwiChatSessionSeed(null, "today")).toBe(0);
  });

  it("is deterministic — same input → same output", () => {
    const r1 = applyKiwiChatSessionEvent(makeKiwiChatSessionState(), {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    const r2 = applyKiwiChatSessionEvent(makeKiwiChatSessionState(), {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r1).toEqual(r2);
  });

  it("malformed prior state sanitized — unrelated panels preserved", () => {
    const malformed = {
      streak: {
        streakByPanel: { today: "bad" as unknown as number, kiwi: 1 },
        lastEventAtUtcMs: {},
      },
      rotation: { counterByPanel: { today: -2, kiwi: 4 } },
    } as Parameters<typeof applyKiwiChatSessionEvent>[0];
    const r = applyKiwiChatSessionEvent(malformed, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    });
    expect(r.state.streak.streakByPanel.today).toBe(1);
    expect(r.state.streak.streakByPanel.kiwi).toBe(1);
    expect(r.state.rotation.counterByPanel.kiwi).toBe(4);
  });

  it("rotation only advances when blessed fallback fires (not on every major)", () => {
    let state = makeKiwiChatSessionState();
    state = applyKiwiChatSessionEvent(state, {
      panel: "today",
      severity: "major",
      timestampUtcMs: TS,
    }).state;
    // After first major: rotation unchanged
    expect(state.rotation.counterByPanel.today ?? 0).toBe(0);
  });
});
