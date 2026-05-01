import { describe, it, expect } from "vitest";
import { coinBalance } from "./db";

describe("coinBalance contract", () => {
  it("returns balance/earned/spent shape that AdultCoinCounter expects", async () => {
    const r = await coinBalance(null);
    expect(r).toBeDefined();
    expect(typeof r.balance).toBe("number");
    expect(typeof r.earned).toBe("number");
    expect(typeof r.spent).toBe("number");
    // balance = earned - spent
    expect(r.balance).toBe(r.earned - r.spent);
    // never negative spent (counted as Math.abs)
    expect(r.spent).toBeGreaterThanOrEqual(0);
    expect(r.earned).toBeGreaterThanOrEqual(0);
  });

  it("respects userId filter (returns 0/0/0 for nonexistent user)", async () => {
    const r = await coinBalance(-9999999);
    expect(r.balance).toBe(0);
    expect(r.earned).toBe(0);
    expect(r.spent).toBe(0);
  });
});
