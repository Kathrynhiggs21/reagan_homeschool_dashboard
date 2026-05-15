import { describe, it, expect } from "vitest";
import { decideKiwiMaintenance } from "./_lib/kiwiSessionMaintenanceScheduler";

const NOW = 1779000000000;
const MIN = 60 * 1000;

describe("kiwiSessionMaintenanceScheduler — cadence gate", () => {
  it("first run when lastMaintenanceAtUtcMs is undefined", () => {
    const r = decideKiwiMaintenance({ nowUtcMs: NOW });
    expect(r.decision).toBe("run");
    expect(r.reason).toBe("first run");
    expect(r.nextEligibleAtUtcMs).toBe(NOW + 5 * MIN);
  });

  it("first run when last is null", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: null,
      nowUtcMs: NOW,
    });
    expect(r.decision).toBe("run");
  });

  it("first run when last is non-finite (NaN)", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NaN,
      nowUtcMs: NOW,
    });
    expect(r.decision).toBe("run");
  });

  it("skip when within default cooldown (1 min after last)", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW - MIN,
      nowUtcMs: NOW,
    });
    expect(r.decision).toBe("skip");
    expect(r.reason).toBe("cooldown not elapsed");
    expect(r.nextEligibleAtUtcMs).toBe(NOW - MIN + 5 * MIN);
  });

  it("run when cooldown elapsed (6 min after last)", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW - 6 * MIN,
      nowUtcMs: NOW,
    });
    expect(r.decision).toBe("run");
    expect(r.reason).toBe("cooldown elapsed");
    expect(r.nextEligibleAtUtcMs).toBe(NOW + 5 * MIN);
  });

  it("run at exactly cooldown boundary", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW - 5 * MIN,
      nowUtcMs: NOW,
    });
    expect(r.decision).toBe("run");
  });

  it("custom cooldown respected", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW - 30 * MIN,
      nowUtcMs: NOW,
      cooldownMs: 60 * MIN, // 1 hour
    });
    expect(r.decision).toBe("skip");
    expect(r.nextEligibleAtUtcMs).toBe(NOW - 30 * MIN + 60 * MIN);
  });

  it("cooldownMs=0 → always run when last is in the past", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW - 1,
      nowUtcMs: NOW,
      cooldownMs: 0,
    });
    expect(r.decision).toBe("run");
  });

  it("nowUtcMs non-finite → skip with clear reason", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW - 6 * MIN,
      nowUtcMs: NaN,
    });
    expect(r.decision).toBe("skip");
    expect(r.reason).toBe("now timestamp is not finite");
    expect(r.nextEligibleAtUtcMs).toBeNull();
  });

  it("negative nowUtcMs → skip", () => {
    const r = decideKiwiMaintenance({ nowUtcMs: -1 });
    expect(r.decision).toBe("skip");
  });

  it("clock going backwards (last in future) → skip until natural cooldown", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW + MIN,
      nowUtcMs: NOW,
    });
    expect(r.decision).toBe("skip");
  });

  it("invalid negative cooldownMs falls back to default", () => {
    const r = decideKiwiMaintenance({
      lastMaintenanceAtUtcMs: NOW - MIN,
      nowUtcMs: NOW,
      cooldownMs: -1,
    });
    expect(r.decision).toBe("skip"); // default 5min cooldown applies
  });

  it("is deterministic — same input → same output", () => {
    const input = {
      lastMaintenanceAtUtcMs: NOW - 3 * MIN,
      nowUtcMs: NOW,
    };
    expect(decideKiwiMaintenance(input)).toEqual(decideKiwiMaintenance(input));
  });
});
