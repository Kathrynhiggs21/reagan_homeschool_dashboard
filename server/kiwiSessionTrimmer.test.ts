import { describe, it, expect } from "vitest";
import { trimKiwiSessionState } from "./_lib/kiwiSessionTrimmer";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";

const NOW = 1779000000000;
const DAY = 24 * 60 * 60 * 1000;

describe("kiwiSessionTrimmer — bounded localStorage growth", () => {
  it("empty state → empty trim (no panels)", () => {
    const r = trimKiwiSessionState(makeKiwiChatSessionState(), NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state).toEqual(makeKiwiChatSessionState());
  });

  it("live streak (>0) → preserved", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = NOW - 31 * DAY; // even with stale ts
    const r = trimKiwiSessionState(s, NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state.streak.streakByPanel.today).toBe(2);
  });

  it("non-zero rotation counter → preserved (blessed rotation must survive)", () => {
    const s = makeKiwiChatSessionState();
    s.rotation.counterByPanel.kiwi = 4;
    // No streak, no recent ts
    const r = trimKiwiSessionState(s, NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state.rotation.counterByPanel.kiwi).toBe(4);
  });

  it("recent timestamp (≤ 30d) → preserved", () => {
    const s = makeKiwiChatSessionState();
    s.streak.lastEventAtUtcMs.bookshelf = NOW - 7 * DAY;
    const r = trimKiwiSessionState(s, NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state.streak.lastEventAtUtcMs.bookshelf).toBe(NOW - 7 * DAY);
  });

  it("dead-weight panel (zero streak, zero rotation, stale ts) → trimmed", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    s.rotation.counterByPanel.today = 0;
    const r = trimKiwiSessionState(s, NOW);
    expect(r.trimmedPanels).toEqual(["today"]);
    expect("today" in r.state.streak.streakByPanel).toBe(false);
    expect("today" in r.state.streak.lastEventAtUtcMs).toBe(false);
    expect("today" in r.state.rotation.counterByPanel).toBe(false);
  });

  it("dead-weight panel (no timestamp) → trimmed", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.kiwi = 0;
    // No lastEventAtUtcMs entry, no rotation entry
    const r = trimKiwiSessionState(s, NOW);
    expect(r.trimmedPanels).toEqual(["kiwi"]);
  });

  it("custom purgeOlderThanMs respected", () => {
    const s = makeKiwiChatSessionState();
    s.streak.lastEventAtUtcMs.today = NOW - 8 * DAY;
    const r = trimKiwiSessionState(s, NOW, 7 * DAY);
    expect(r.trimmedPanels).toEqual(["today"]);
  });

  it("multi-panel: only dead-weight panels trimmed", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1; // live
    s.streak.lastEventAtUtcMs.today = NOW - 1000;
    s.streak.streakByPanel.kiwi = 0; // dead
    s.streak.lastEventAtUtcMs.kiwi = NOW - 45 * DAY;
    s.rotation.counterByPanel.bookshelf = 2; // live via rotation
    const r = trimKiwiSessionState(s, NOW);
    expect(r.trimmedPanels).toEqual(["kiwi"]);
    expect(r.state.streak.streakByPanel.today).toBe(1);
    expect(r.state.rotation.counterByPanel.bookshelf).toBe(2);
  });

  it("input state never mutated", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    const snap = JSON.stringify(s);
    trimKiwiSessionState(s, NOW);
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("null/undefined state → empty + no trim", () => {
    const r1 = trimKiwiSessionState(null, NOW);
    const r2 = trimKiwiSessionState(undefined, NOW);
    expect(r1.state).toEqual(makeKiwiChatSessionState());
    expect(r2.state).toEqual(makeKiwiChatSessionState());
    expect(r1.trimmedPanels).toEqual([]);
  });

  it("non-finite nowUtcMs → no trim (conservative)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    const r = trimKiwiSessionState(s, NaN);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state.streak.lastEventAtUtcMs.today).toBe(NOW - 45 * DAY);
  });

  it("orphan entry (only lastEventAt key, no streak/rotation key) → trimmed when stale", () => {
    const s = makeKiwiChatSessionState();
    s.streak.lastEventAtUtcMs.feeling = NOW - 45 * DAY;
    const r = trimKiwiSessionState(s, NOW);
    expect(r.trimmedPanels).toEqual(["feeling"]);
  });

  it("is deterministic — same input → same output", () => {
    const s1 = makeKiwiChatSessionState();
    s1.streak.streakByPanel.today = 0;
    s1.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    const s2 = makeKiwiChatSessionState();
    s2.streak.streakByPanel.today = 0;
    s2.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    expect(trimKiwiSessionState(s1, NOW)).toEqual(trimKiwiSessionState(s2, NOW));
  });
});
