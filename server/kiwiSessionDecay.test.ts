import { describe, it, expect } from "vitest";
import { decayKiwiSessionState } from "./_lib/kiwiSessionDecay";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";

const NOW = 1779000000000;
const MIN_30 = 30 * 60 * 1000;
const HR_6 = 6 * 60 * 60 * 1000;

function stateWith(streak: number, lastUtc: number) {
  const s = makeKiwiChatSessionState();
  if (streak > 0) {
    s.streak.streakByPanel.today = streak;
    s.streak.lastEventAtUtcMs.today = lastUtc;
  }
  return s;
}

describe("kiwiSessionDecay — stale per-panel streak decay", () => {
  it("quiet < 30min → no decay", () => {
    const r = decayKiwiSessionState(stateWith(2, NOW - (MIN_30 - 1)), NOW);
    expect(r.state.streak.streakByPanel.today).toBe(2);
    expect(r.decayedPanels).toEqual([]);
  });

  it("quiet exactly 30min → streak -1", () => {
    const r = decayKiwiSessionState(stateWith(2, NOW - MIN_30), NOW);
    expect(r.state.streak.streakByPanel.today).toBe(1);
    expect(r.decayedPanels).toEqual(["today"]);
  });

  it("quiet ≥ 6h → streak full reset to 0", () => {
    const r = decayKiwiSessionState(stateWith(5, NOW - HR_6), NOW);
    expect(r.state.streak.streakByPanel.today).toBe(0);
    expect(r.decayedPanels).toEqual(["today"]);
  });

  it("quiet 2h with streak 2 → decays by 4 → floored at 0", () => {
    const r = decayKiwiSessionState(
      stateWith(2, NOW - 2 * 60 * 60 * 1000),
      NOW,
    );
    expect(r.state.streak.streakByPanel.today).toBe(0);
  });

  it("streak 0 → never decays (no-op)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.lastEventAtUtcMs.today = NOW - HR_6;
    const r = decayKiwiSessionState(s, NOW);
    expect(r.decayedPanels).toEqual([]);
    expect(r.state.streak.streakByPanel.today ?? 0).toBe(0);
  });

  it("missing lastEventAt → full reset (ancient)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 3;
    // No lastEventAtUtcMs entry
    const r = decayKiwiSessionState(s, NOW);
    expect(r.state.streak.streakByPanel.today).toBe(0);
    expect(r.decayedPanels).toEqual(["today"]);
  });

  it("rotation counters are NEVER decayed", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = NOW - HR_6;
    s.rotation.counterByPanel.today = 7;
    const r = decayKiwiSessionState(s, NOW);
    expect(r.state.streak.streakByPanel.today).toBe(0);
    expect(r.state.rotation.counterByPanel.today).toBe(7);
  });

  it("panel scoping — only stale panels decay", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = NOW - HR_6; // stale
    s.streak.streakByPanel.kiwi = 1;
    s.streak.lastEventAtUtcMs.kiwi = NOW - (MIN_30 - 1); // fresh
    const r = decayKiwiSessionState(s, NOW);
    expect(r.state.streak.streakByPanel.today).toBe(0);
    expect(r.state.streak.streakByPanel.kiwi).toBe(1);
    expect(r.decayedPanels).toEqual(["today"]);
  });

  it("input state never mutated", () => {
    const s = stateWith(3, NOW - HR_6);
    const snap = JSON.stringify(s);
    decayKiwiSessionState(s, NOW);
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("null/undefined state → empty + no decay", () => {
    const r1 = decayKiwiSessionState(null, NOW);
    const r2 = decayKiwiSessionState(undefined, NOW);
    expect(r1.state).toEqual(makeKiwiChatSessionState());
    expect(r2.state).toEqual(makeKiwiChatSessionState());
    expect(r1.decayedPanels).toEqual([]);
  });

  it("non-finite nowUtcMs → no decay", () => {
    const s = stateWith(2, NOW - HR_6);
    const r = decayKiwiSessionState(s, NaN);
    expect(r.state.streak.streakByPanel.today).toBe(2);
    expect(r.decayedPanels).toEqual([]);
  });

  it("decayedPanels reports only panels that changed", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    s.streak.lastEventAtUtcMs.today = NOW - MIN_30;
    s.streak.streakByPanel.kiwi = 1;
    s.streak.lastEventAtUtcMs.kiwi = NOW - (MIN_30 - 1);
    const r = decayKiwiSessionState(s, NOW);
    expect(r.decayedPanels).toEqual(["today"]);
  });

  it("is deterministic — same input → same output", () => {
    const s1 = stateWith(2, NOW - MIN_30);
    const s2 = stateWith(2, NOW - MIN_30);
    expect(decayKiwiSessionState(s1, NOW)).toEqual(
      decayKiwiSessionState(s2, NOW),
    );
  });
});
