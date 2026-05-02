import { describe, it, expect } from "vitest";
import { ensurePlanForDate, listBlocksForPlan, isWeekendDate, refreshTodayPlan } from "./db";

/**
 * Weekend rule (per user, May 2 2026):
 *   On Saturday and Sunday, NO daily school or assignments are auto-generated.
 *   The plan row exists so the UI can render "free day", but its blocks list
 *   stays empty unless an adult (parent / editor / tutor) explicitly adds
 *   something via the schedule editor or AI generator with `allowWeekend: true`.
 */
describe("weekend rule \u2014 no auto-generated school on Sat/Sun", () => {
  it("isWeekendDate identifies Sat (6) and Sun (0)", () => {
    expect(isWeekendDate("2026-05-02")).toBe(true); // Sat
    expect(isWeekendDate("2026-05-03")).toBe(true); // Sun
    expect(isWeekendDate("2026-05-04")).toBe(false); // Mon
    expect(isWeekendDate("2026-05-06")).toBe(false); // Wed
    expect(isWeekendDate("2026-05-08")).toBe(false); // Fri
  });

  it("Saturday plan is created but seeded with ZERO auto blocks", async () => {
    // Use a future Saturday to avoid colliding with any pre-seeded data.
    const sat = "2030-01-05"; // Saturday
    const plan = await ensurePlanForDate(sat);
    expect(plan).toBeTruthy();
    expect((plan as any).dayType).toBe("off");
    const blocks = await listBlocksForPlan(plan!.id);
    expect((blocks as any[]).length).toBe(0);
  });

  it("Sunday plan is created but seeded with ZERO auto blocks", async () => {
    const sun = "2030-01-06"; // Sunday
    const plan = await ensurePlanForDate(sun);
    expect(plan).toBeTruthy();
    expect((plan as any).dayType).toBe("off");
    const blocks = await listBlocksForPlan(plan!.id);
    expect((blocks as any[]).length).toBe(0);
  });

  it("refreshTodayPlan on a weekend day refuses to auto-fill blocks", async () => {
    const sat = "2030-01-12"; // Saturday
    const r: any = await refreshTodayPlan({ dateStr: sat });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("weekend");
    expect(r.added).toBe(0);
  });

  it("explicit allowWeekend override DOES rebuild blocks (adult opt-in)", async () => {
    const sat = "2030-01-19"; // Saturday
    // First ensure plan exists (without auto blocks)
    await ensurePlanForDate(sat);
    const r: any = await refreshTodayPlan({ dateStr: sat, allowWeekend: true });
    expect(r.ok).toBe(true);
    expect(r.added).toBeGreaterThan(0);
  });
});
