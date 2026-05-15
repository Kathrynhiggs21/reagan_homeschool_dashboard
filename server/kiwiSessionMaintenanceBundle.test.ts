import { describe, it, expect } from "vitest";
import { runKiwiSessionMaintenance } from "./_lib/kiwiSessionMaintenanceBundle";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";
import { importKiwiSessionState } from "./_lib/kiwiSessionExportSerializer";

const NOW = 1779000000000;
const DAY = 24 * 60 * 60 * 1000;

describe("kiwiSessionMaintenanceBundle — trim + audit + re-export", () => {
  it("empty state → no trim, ok recommendation, valid re-export", () => {
    const r = runKiwiSessionMaintenance(makeKiwiChatSessionState(), NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.audit.recommendation).toBe("ok");
    expect(importKiwiSessionState(r.reExported)).toEqual(r.state);
  });

  it("dead-weight panel is trimmed and the audit reflects post-trim state", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    s.rotation.counterByPanel.today = 0;
    s.streak.streakByPanel.kiwi = 1;
    s.streak.lastEventAtUtcMs.kiwi = NOW - 1000;
    const r = runKiwiSessionMaintenance(s, NOW);
    expect(r.trimmedPanels).toEqual(["today"]);
    expect(r.audit.totalPanels).toBe(1);
    expect(r.audit.livePanels).toBe(1);
  });

  it("live streak (>0) survives trim even with stale timestamp", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = NOW - 60 * DAY;
    const r = runKiwiSessionMaintenance(s, NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state.streak.streakByPanel.today).toBe(2);
  });

  it("non-zero rotation counter survives trim across long quiet periods", () => {
    const s = makeKiwiChatSessionState();
    s.rotation.counterByPanel.kiwi = 3;
    const r = runKiwiSessionMaintenance(s, NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state.rotation.counterByPanel.kiwi).toBe(3);
  });

  it("custom purge window respected (trim aggressive)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.lastEventAtUtcMs.today = NOW - 8 * DAY;
    const r = runKiwiSessionMaintenance(s, NOW, { purgeOlderThanMs: 7 * DAY });
    expect(r.trimmedPanels).toEqual(["today"]);
  });

  it("custom audit thresholds respected (force trim_now)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    s.streak.lastEventAtUtcMs.today = NOW - 1000;
    const r = runKiwiSessionMaintenance(s, NOW, {
      considerTrimBytes: 10,
      trimNowBytes: 20,
    });
    expect(r.audit.recommendation).toBe("trim_now");
  });

  it("null state → empty trimmed state + ok recommendation", () => {
    const r = runKiwiSessionMaintenance(null, NOW);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.audit.totalPanels).toBe(0);
    expect(r.audit.recommendation).toBe("ok");
  });

  it("undefined state → empty trimmed state", () => {
    const r = runKiwiSessionMaintenance(undefined, NOW);
    expect(r.audit.totalPanels).toBe(0);
  });

  it("non-finite nowUtcMs → no trim (conservative)", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    const r = runKiwiSessionMaintenance(s, NaN);
    expect(r.trimmedPanels).toEqual([]);
    expect(r.state.streak.lastEventAtUtcMs.today).toBe(NOW - 45 * DAY);
  });

  it("input state never mutated by maintenance pass", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    const snap = JSON.stringify(s);
    runKiwiSessionMaintenance(s, NOW);
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("is deterministic — same input → same output", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    expect(runKiwiSessionMaintenance(s, NOW)).toEqual(
      runKiwiSessionMaintenance(s, NOW),
    );
  });

  it("idempotent: running maintenance on the re-exported state's deserialization yields no trim", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    s.streak.streakByPanel.kiwi = 1;
    s.streak.lastEventAtUtcMs.kiwi = NOW - 1000;
    const first = runKiwiSessionMaintenance(s, NOW);
    const second = runKiwiSessionMaintenance(
      importKiwiSessionState(first.reExported),
      NOW,
    );
    expect(second.trimmedPanels).toEqual([]);
    expect(second.state).toEqual(first.state);
  });

  it("re-export is a string round-trippable to the trimmed state", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    s.streak.streakByPanel.kiwi = 1;
    s.streak.lastEventAtUtcMs.kiwi = NOW - 1000;
    const r = runKiwiSessionMaintenance(s, NOW);
    expect(typeof r.reExported).toBe("string");
    expect(importKiwiSessionState(r.reExported)).toEqual(r.state);
  });
});
