/**
 * Push 115 (2026-05-13) — Reagan reward-coin counter contract.
 */
import { describe, it, expect } from "vitest";
import { applyCoinOps } from "./_lib/reaganRewardCoins";

describe("Push 115 — Reagan reward-coin counter", () => {
  it("empty op stream returns startingBalance unchanged", () => {
    const r = applyCoinOps(20, []);
    expect(r.endingBalance).toBe(20);
    expect(r.startingBalance).toBe(20);
    expect(r.applied).toEqual([]);
    expect(r.rejected).toEqual([]);
    expect(r.totalEarned).toBe(0);
    expect(r.totalSpent).toBe(0);
  });

  it("earn increases, spend decreases, balanceAfter recorded", () => {
    const r = applyCoinOps(0, [
      { kind: "earn", amount: 5, reason: "math worksheet" },
      { kind: "earn", amount: 3, reason: "tidied desk" },
      { kind: "spend", amount: 4, reason: "Roblox 15 min" },
    ]);
    expect(r.endingBalance).toBe(4);
    expect(r.applied.map((a) => a.balanceAfter)).toEqual([5, 8, 4]);
    expect(r.totalEarned).toBe(8);
    expect(r.totalSpent).toBe(4);
  });

  it("would-overdraw spend is rejected and balance untouched", () => {
    const r = applyCoinOps(2, [
      { kind: "spend", amount: 5, reason: "candy" },
    ]);
    expect(r.endingBalance).toBe(2);
    expect(r.applied).toHaveLength(0);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].rejectReason).toBe("would-overdraw");
  });

  it("rejects unknown kind / non-finite / non-positive / missing reason with distinct rejectReason", () => {
    const r = applyCoinOps(10, [
      { kind: "transfer", amount: 1, reason: "x" } as any,
      { kind: "earn", amount: NaN, reason: "x" },
      { kind: "earn", amount: 0, reason: "x" },
      { kind: "earn", amount: -3, reason: "x" },
      { kind: "spend", amount: 2, reason: "" },
      { kind: "spend", amount: 2, reason: "   " },
    ]);
    const reasons = r.rejected.map((x) => x.rejectReason);
    expect(reasons).toContain("unknown-kind");
    expect(reasons).toContain("non-finite-amount");
    expect(reasons).toContain("non-positive-amount");
    expect(reasons).toContain("missing-reason");
    // -3 also non-positive
    expect(reasons.filter((r) => r === "non-positive-amount").length).toBe(2);
    // Two missing-reason entries (empty string + whitespace)
    expect(reasons.filter((r) => r === "missing-reason").length).toBe(2);
    expect(r.endingBalance).toBe(10);
  });

  it("starting balance non-finite or negative falls back to 0", () => {
    expect(applyCoinOps(NaN, []).startingBalance).toBe(0);
    expect(applyCoinOps(-5, []).startingBalance).toBe(0);
    expect(applyCoinOps(Infinity, []).startingBalance).toBe(0);
  });

  it("floors fractional amounts", () => {
    const r = applyCoinOps(0, [
      { kind: "earn", amount: 5.9, reason: "task" },
      { kind: "earn", amount: 2.1, reason: "task2" },
    ]);
    expect(r.applied[0].amount).toBe(5);
    expect(r.applied[1].amount).toBe(2);
    expect(r.endingBalance).toBe(7);
  });

  it("rejects null/undefined op entries cleanly without throwing", () => {
    const r = applyCoinOps(5, [
      null as any,
      undefined as any,
      { kind: "earn", amount: 1, reason: "tidy" },
    ]);
    expect(r.endingBalance).toBe(6);
    expect(r.applied).toHaveLength(1);
    expect(r.rejected.length).toBeGreaterThanOrEqual(2);
  });

  it("kind matching is case-insensitive", () => {
    const r = applyCoinOps(0, [{ kind: "EARN", amount: 4, reason: "x" }]);
    expect(r.applied).toHaveLength(1);
    expect(r.endingBalance).toBe(4);
  });

  it("preserves reason + atIso passthrough on applied ops", () => {
    const r = applyCoinOps(0, [
      { kind: "earn", amount: 3, reason: "math", atIso: "2026-05-13T10:00:00Z" },
    ]);
    expect(r.applied[0].reason).toBe("math");
    expect(r.applied[0].atIso).toBe("2026-05-13T10:00:00Z");
  });

  it("non-array ops returns starting balance unchanged", () => {
    const r = applyCoinOps(7, undefined as any);
    expect(r.endingBalance).toBe(7);
    expect(r.applied).toEqual([]);
    expect(r.rejected).toEqual([]);
  });
});
