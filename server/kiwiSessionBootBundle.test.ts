import { describe, it, expect } from "vitest";
import { bootKiwiSession } from "./_lib/kiwiSessionBootBundle";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";
import {
  exportKiwiSessionState,
  importKiwiSessionState,
  KIWI_SESSION_SCHEMA_VERSION,
} from "./_lib/kiwiSessionExportSerializer";

const NOW = 1779000000000;
const MIN_30 = 30 * 60 * 1000;
const HR_6 = 6 * 60 * 60 * 1000;

describe("kiwiSessionBootBundle — mount-time migrate + decay", () => {
  it("null raw → fresh state + fresh migrationPath + no decay", () => {
    const r = bootKiwiSession(null, NOW);
    expect(r.migrationPath).toBe("fresh");
    expect(r.decayedPanels).toEqual([]);
    expect(r.state).toEqual(makeKiwiChatSessionState());
  });

  it("current envelope + fresh streak → 'current' + no decay", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    s.streak.lastEventAtUtcMs.today = NOW - 1000;
    const raw = exportKiwiSessionState(s);
    const r = bootKiwiSession(raw, NOW);
    expect(r.migrationPath).toBe("current");
    expect(r.decayedPanels).toEqual([]);
    expect(r.state.streak.streakByPanel.today).toBe(1);
  });

  it("current envelope + stale streak (≥6h) → decays to 0", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = NOW - HR_6;
    const raw = exportKiwiSessionState(s);
    const r = bootKiwiSession(raw, NOW);
    expect(r.migrationPath).toBe("current");
    expect(r.decayedPanels).toEqual(["today"]);
    expect(r.state.streak.streakByPanel.today).toBe(0);
  });

  it("bare-v0 blob + stale streak → upgrade + decay in one shot", () => {
    const bareV0 = JSON.stringify({
      streak: {
        streakByPanel: { today: 2 },
        lastEventAtUtcMs: { today: NOW - HR_6 },
      },
      rotation: { counterByPanel: { today: 4 } },
    });
    const r = bootKiwiSession(bareV0, NOW);
    expect(r.migrationPath).toBe("v0_to_v1");
    expect(r.decayedPanels).toEqual(["today"]);
    expect(r.state.streak.streakByPanel.today).toBe(0);
    // Rotation counter preserved (decay does not touch it)
    expect(r.state.rotation.counterByPanel.today).toBe(4);
  });

  it("re-export is a current-envelope string round-trippable to the returned state", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    s.streak.lastEventAtUtcMs.today = NOW - MIN_30;
    s.rotation.counterByPanel.today = 3;
    const r = bootKiwiSession(exportKiwiSessionState(s), NOW);
    const parsed = JSON.parse(r.reExported);
    expect(parsed.schemaVersion).toBe(KIWI_SESSION_SCHEMA_VERSION);
    expect(importKiwiSessionState(r.reExported)).toEqual(r.state);
  });

  it("malformed JSON → discarded path + fresh state", () => {
    const r = bootKiwiSession("{not-json", NOW);
    expect(r.migrationPath).toBe("discarded");
    expect(r.decayedPanels).toEqual([]);
    expect(r.state).toEqual(makeKiwiChatSessionState());
  });

  it("future schemaVersion → discarded path", () => {
    const raw = JSON.stringify({
      schemaVersion: 999,
      state: { streak: {}, rotation: {} },
    });
    const r = bootKiwiSession(raw, NOW);
    expect(r.migrationPath).toBe("discarded");
  });

  it("input raw never mutated", () => {
    const bareV0 = JSON.stringify({
      streak: { streakByPanel: { today: 1 } },
      rotation: { counterByPanel: {} },
    });
    const snap = bareV0.slice();
    bootKiwiSession(bareV0, NOW);
    expect(bareV0).toBe(snap);
  });

  it("non-finite nowUtcMs → no decay (state still returned)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = NOW - HR_6;
    const r = bootKiwiSession(exportKiwiSessionState(s), NaN);
    expect(r.decayedPanels).toEqual([]);
    expect(r.state.streak.streakByPanel.today).toBe(2);
  });

  it("multi-panel: only stale panels decay", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = NOW - HR_6;
    s.streak.streakByPanel.kiwi = 1;
    s.streak.lastEventAtUtcMs.kiwi = NOW - 1000;
    const r = bootKiwiSession(exportKiwiSessionState(s), NOW);
    expect(r.decayedPanels).toEqual(["today"]);
    expect(r.state.streak.streakByPanel.today).toBe(0);
    expect(r.state.streak.streakByPanel.kiwi).toBe(1);
  });

  it("is deterministic — same input → same output", () => {
    const raw = JSON.stringify({
      schemaVersion: KIWI_SESSION_SCHEMA_VERSION,
      state: {
        streak: {
          streakByPanel: { today: 2 },
          lastEventAtUtcMs: { today: NOW - HR_6 },
        },
        rotation: { counterByPanel: { today: 1 } },
      },
    });
    expect(bootKiwiSession(raw, NOW)).toEqual(bootKiwiSession(raw, NOW));
  });

  it("idempotent: booting the re-export produces the same state and 'current' path", () => {
    const bareV0 = JSON.stringify({
      streak: {
        streakByPanel: { today: 1 },
        lastEventAtUtcMs: { today: NOW - 1000 },
      },
      rotation: { counterByPanel: { today: 0 } },
    });
    const r1 = bootKiwiSession(bareV0, NOW);
    const r2 = bootKiwiSession(r1.reExported, NOW);
    expect(r2.migrationPath).toBe("current");
    expect(r2.state).toEqual(r1.state);
  });
});
