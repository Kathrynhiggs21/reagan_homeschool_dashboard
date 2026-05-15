import { describe, it, expect } from "vitest";
import { runKiwiGatedMaintenance } from "./_lib/kiwiSessionGatedMaintenance";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";
import { importKiwiSessionState } from "./_lib/kiwiSessionExportSerializer";

const NOW = 1779000000000;
const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

describe("kiwiSessionGatedMaintenance — decide-then-maybe-run", () => {
  it("first run: gate says run, maintenance executes", () => {
    const r = runKiwiGatedMaintenance({
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: NOW,
    });
    expect(r.schedule.decision).toBe("run");
    expect(r.ranMaintenance).toBe(true);
    expect(r.maintenance).not.toBeNull();
    expect(r.maintenance!.trimmedPanels).toEqual([]);
  });

  it("within cooldown: gate says skip, maintenance does NOT run", () => {
    const r = runKiwiGatedMaintenance({
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: NOW,
      lastMaintenanceAtUtcMs: NOW - MIN,
    });
    expect(r.schedule.decision).toBe("skip");
    expect(r.ranMaintenance).toBe(false);
    expect(r.maintenance).toBeNull();
  });

  it("cooldown elapsed: maintenance runs and trims dead weight", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 0;
    s.streak.lastEventAtUtcMs.today = NOW - 45 * DAY;
    s.rotation.counterByPanel.today = 0;
    const r = runKiwiGatedMaintenance({
      priorState: s,
      nowUtcMs: NOW,
      lastMaintenanceAtUtcMs: NOW - 6 * MIN,
    });
    expect(r.schedule.decision).toBe("run");
    expect(r.ranMaintenance).toBe(true);
    expect(r.maintenance!.trimmedPanels).toEqual(["today"]);
  });

  it("schedule diagnostics returned even when skipping", () => {
    const r = runKiwiGatedMaintenance({
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: NOW,
      lastMaintenanceAtUtcMs: NOW - 2 * MIN,
    });
    expect(r.schedule.decision).toBe("skip");
    expect(r.schedule.nextEligibleAtUtcMs).toBe(NOW - 2 * MIN + 5 * MIN);
    expect(r.schedule.reason).toBe("cooldown not elapsed");
  });

  it("custom cooldown: 60min skip until elapsed", () => {
    const r = runKiwiGatedMaintenance({
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: NOW,
      lastMaintenanceAtUtcMs: NOW - 30 * MIN,
      cooldownMs: 60 * MIN,
    });
    expect(r.ranMaintenance).toBe(false);
  });

  it("custom audit threshold forwarded to maintenance", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    s.streak.lastEventAtUtcMs.today = NOW - 1000;
    const r = runKiwiGatedMaintenance({
      priorState: s,
      nowUtcMs: NOW,
      considerTrimBytes: 10,
      trimNowBytes: 20,
    });
    expect(r.ranMaintenance).toBe(true);
    expect(r.maintenance!.audit.recommendation).toBe("trim_now");
  });

  it("custom purge window forwarded to maintenance", () => {
    const s = makeKiwiChatSessionState();
    s.streak.lastEventAtUtcMs.today = NOW - 8 * DAY;
    const r = runKiwiGatedMaintenance({
      priorState: s,
      nowUtcMs: NOW,
      purgeOlderThanMs: 7 * DAY,
    });
    expect(r.ranMaintenance).toBe(true);
    expect(r.maintenance!.trimmedPanels).toEqual(["today"]);
  });

  it("re-export is round-trippable to the maintenance result state", () => {
    const r = runKiwiGatedMaintenance({
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: NOW,
    });
    expect(r.ranMaintenance).toBe(true);
    expect(importKiwiSessionState(r.maintenance!.reExported)).toEqual(
      r.maintenance!.state,
    );
  });

  it("non-finite nowUtcMs: schedule skips, no maintenance", () => {
    const r = runKiwiGatedMaintenance({
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: NaN,
    });
    expect(r.schedule.decision).toBe("skip");
    expect(r.ranMaintenance).toBe(false);
  });

  it("null priorState handled (maintenance returns empty state)", () => {
    const r = runKiwiGatedMaintenance({
      priorState: null,
      nowUtcMs: NOW,
    });
    expect(r.ranMaintenance).toBe(true);
    expect(r.maintenance!.audit.totalPanels).toBe(0);
  });

  it("is deterministic — same input → same output", () => {
    const input = {
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: NOW,
      lastMaintenanceAtUtcMs: NOW - 6 * MIN,
    };
    const a = runKiwiGatedMaintenance(input);
    const b = runKiwiGatedMaintenance(input);
    expect(a).toEqual(b);
  });

  it("idempotent: rerunning right after a successful run skips (cooldown enforced)", () => {
    const firstRunAt = NOW - 6 * MIN;
    const first = runKiwiGatedMaintenance({
      priorState: makeKiwiChatSessionState(),
      nowUtcMs: firstRunAt,
    });
    expect(first.ranMaintenance).toBe(true);
    const second = runKiwiGatedMaintenance({
      priorState: first.maintenance!.state,
      nowUtcMs: firstRunAt + MIN,
      lastMaintenanceAtUtcMs: firstRunAt,
    });
    expect(second.ranMaintenance).toBe(false);
  });
});
