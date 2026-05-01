import { describe, it, expect } from "vitest";
import { ensurePlanForDate, listBlocksForPlan } from "./db";

describe("ensurePlanForDate (Phase 7 — weekend)", () => {
  it("seeds Saturday May 2 2026 with the weekend template, not weekday school blocks", async () => {
    const plan = await ensurePlanForDate("2026-05-02"); // Saturday
    expect(plan).toBeTruthy();
    const blocks = await listBlocksForPlan(plan!.id);
    const titles = (blocks as any[]).map((b) => b.title);
    expect(titles[0]).toBe("Slow morning");
    expect(titles).toContain("Pick-your-path adventure");
    expect(titles).toContain("Family read-aloud");
    expect(titles).toContain("Choice play");
    expect(titles).toContain("One little win");
    expect(titles).not.toContain("Math warm-up");
    expect(titles).not.toContain("Reading + writing");
  });

  it("Sunday produces the same gentle weekend template", async () => {
    const plan = await ensurePlanForDate("2026-05-03"); // Sunday
    expect(plan).toBeTruthy();
    const blocks = await listBlocksForPlan(plan!.id);
    const titles = (blocks as any[]).map((b) => b.title);
    expect(titles[0]).toBe("Slow morning");
  });
});
