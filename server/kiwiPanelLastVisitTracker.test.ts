import { describe, it, expect } from "vitest";
import { applyKiwiPanelVisit } from "./_lib/kiwiPanelLastVisitTracker";

const MIN = 60_000;

describe("kiwiPanelLastVisitTracker — panel-scoped greeting suppression", () => {
  it("first visit fires greeting and records now", () => {
    const r = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 1_000_000,
    });
    expect(r.shouldGreet).toBe(true);
    expect(r.reason).toBe("first_visit");
    expect(r.msSinceLastGreet).toBeNull();
    expect(r.state.panels["today"]).toBe(1_000_000);
  });

  it("re-visit within 10 min default window is suppressed", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 1_000_000,
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "today",
      nowUtcMs: 1_000_000 + 3 * MIN,
    });
    expect(r2.shouldGreet).toBe(false);
    expect(r2.reason).toBe("suppressed");
    expect(r2.msSinceLastGreet).toBe(3 * MIN);
    // State unchanged
    expect(r2.state.panels["today"]).toBe(1_000_000);
  });

  it("visit after window fires greeting and updates record", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 0,
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "today",
      nowUtcMs: 11 * MIN,
    });
    expect(r2.shouldGreet).toBe(true);
    expect(r2.reason).toBe("outside_window");
    expect(r2.msSinceLastGreet).toBe(11 * MIN);
    expect(r2.state.panels["today"]).toBe(11 * MIN);
  });

  it("panels are isolated: greeting today doesn't suppress kiwi", () => {
    const a = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 1_000_000,
    });
    const b = applyKiwiPanelVisit({
      prior: a.state,
      panel: "kiwi",
      nowUtcMs: 1_000_000 + 30_000,
    });
    expect(b.shouldGreet).toBe(true);
    expect(b.reason).toBe("first_visit");
    expect(b.state.panels["today"]).toBe(1_000_000);
    expect(b.state.panels["kiwi"]).toBe(1_000_000 + 30_000);
  });

  it("custom suppress window respected", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "stuck",
      nowUtcMs: 0,
      suppressWindowMs: 60_000, // 1 min
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "stuck",
      nowUtcMs: 90_000,
      suppressWindowMs: 60_000,
    });
    expect(r2.shouldGreet).toBe(true);
    expect(r2.reason).toBe("outside_window");
  });

  it("exact boundary (elapsed === window) is treated as outside", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 0,
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "today",
      nowUtcMs: 10 * MIN, // exactly default window
    });
    expect(r2.shouldGreet).toBe(true);
    expect(r2.reason).toBe("outside_window");
  });

  it("backward clock skew treated as outside window", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 1_000_000,
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "today",
      nowUtcMs: 500_000, // earlier than recorded
    });
    expect(r2.shouldGreet).toBe(true);
    expect(r2.reason).toBe("outside_window");
    expect(r2.msSinceLastGreet).toBeNull();
    expect(r2.state.panels["today"]).toBe(500_000);
  });

  it("malformed prior state sanitized to empty", () => {
    const r = applyKiwiPanelVisit({
      prior: { panels: "not-an-object" } as unknown as { panels: Record<string, number> },
      panel: "today",
      nowUtcMs: 1_000_000,
    });
    expect(r.shouldGreet).toBe(true);
    expect(r.reason).toBe("first_visit");
  });

  it("non-finite entries in prior panels dropped", () => {
    const r = applyKiwiPanelVisit({
      prior: {
        panels: {
          today: 1_000_000,
          kiwi: NaN as unknown as number,
          schedule: -5 as unknown as number,
        },
      },
      panel: "kiwi",
      nowUtcMs: 1_000_000 + 60_000,
    });
    // 'kiwi' record was bad → treated as first visit
    expect(r.shouldGreet).toBe(true);
    expect(r.reason).toBe("first_visit");
    expect(r.state.panels["today"]).toBe(1_000_000);
    expect(r.state.panels["schedule"]).toBeUndefined();
  });

  it("non-finite nowUtcMs coerces to 0 (treats as outside window)", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 500_000,
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "today",
      nowUtcMs: NaN,
    });
    // now=0 is BEFORE recorded 500_000 → backward skew → outside window
    expect(r2.shouldGreet).toBe(true);
    expect(r2.reason).toBe("outside_window");
  });

  it("invalid suppressWindowMs falls back to default", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "today",
      nowUtcMs: 0,
      suppressWindowMs: -5,
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "today",
      nowUtcMs: 5 * MIN,
      suppressWindowMs: -5,
    });
    expect(r2.shouldGreet).toBe(false); // within 10-min default
  });

  it("does not mutate input prior state", () => {
    const prior = { panels: { today: 1_000_000 } };
    const before = JSON.stringify(prior);
    applyKiwiPanelVisit({
      prior,
      panel: "today",
      nowUtcMs: 1_000_000 + 30_000,
    });
    expect(JSON.stringify(prior)).toBe(before);
  });

  it("panel name normalized: 'TODAY' === 'today'", () => {
    const r1 = applyKiwiPanelVisit({
      prior: null,
      panel: "TODAY",
      nowUtcMs: 1_000_000,
    });
    const r2 = applyKiwiPanelVisit({
      prior: r1.state,
      panel: "today",
      nowUtcMs: 1_000_000 + 30_000,
    });
    expect(r2.shouldGreet).toBe(false);
    expect(r2.reason).toBe("suppressed");
  });

  it("empty panel name normalizes to 'today'", () => {
    const r = applyKiwiPanelVisit({
      prior: null,
      panel: "",
      nowUtcMs: 1_000_000,
    });
    expect(r.state.panels["today"]).toBe(1_000_000);
  });
});
