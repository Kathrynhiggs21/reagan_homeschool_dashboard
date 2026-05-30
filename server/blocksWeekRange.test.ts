import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";

/**
 * 2026-05-30 — `blocks.weekRange` was added so the Schedule page's
 * agenda-as-calendar feature can fetch all 7 days of blocks in one round-trip.
 *
 * Contract:
 *   - Returns `{ byDate: { [yyyy-mm-dd]: blocks[] } }`.
 *   - Includes every date in the inclusive window, even days with no plan
 *     (those map to `[]`).
 *   - Hard caps at 31 days per call so a runaway client can't trigger 365
 *     plan lookups.
 *   - Reversed window (end < start) returns `{ byDate: {} }`.
 *   - Never calls `ensurePlanForDate` — purely read-only.
 */
describe("blocks.weekRange", () => {
  let getPlanByDateSpy: ReturnType<typeof vi.spyOn>;
  let listBlocksForPlanSpy: ReturnType<typeof vi.spyOn>;
  let ensurePlanForDateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // ensurePlanForDate must NEVER fire from a read.
    ensurePlanForDateSpy = vi
      .spyOn(db as any, "ensurePlanForDate")
      .mockResolvedValue({ id: 999, date: "auto" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function callWeekRange(startDate: string, endDate: string) {
    const caller = appRouter.createCaller({ user: null } as any);
    return caller.blocks.weekRange({ startDate, endDate });
  }

  it("returns each date in the window as a key, even when the plan is missing", async () => {
    getPlanByDateSpy = vi.spyOn(db, "getPlanByDate").mockResolvedValue(null as any);
    listBlocksForPlanSpy = vi.spyOn(db, "listBlocksForPlan").mockResolvedValue([] as any);

    const got = await callWeekRange("2026-06-01", "2026-06-03");

    expect(Object.keys(got.byDate).sort()).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
    for (const k of Object.keys(got.byDate)) expect(got.byDate[k]).toEqual([]);
    expect(ensurePlanForDateSpy).not.toHaveBeenCalled();
  });

  it("includes blocks for days that DO have a plan", async () => {
    getPlanByDateSpy = vi.spyOn(db, "getPlanByDate").mockImplementation(async (dateStr: string) => {
      if (dateStr === "2026-06-02") return { id: 4242, date: dateStr } as any;
      return null as any;
    });
    listBlocksForPlanSpy = vi.spyOn(db, "listBlocksForPlan").mockImplementation(async (planId: number) => {
      if (planId === 4242) {
        return [
          { id: 1, title: "Math", durationMin: 30, startTime: "09:00", planId },
          { id: 2, title: "ELA", durationMin: 30, startTime: "09:35", planId },
        ] as any;
      }
      return [] as any;
    });

    const got = await callWeekRange("2026-06-01", "2026-06-03");
    expect(got.byDate["2026-06-01"]).toEqual([]);
    expect(got.byDate["2026-06-02"]).toHaveLength(2);
    expect(got.byDate["2026-06-02"][0].title).toBe("Math");
    expect(got.byDate["2026-06-03"]).toEqual([]);
  });

  it("hard-caps at 31 days so a year-long range only iterates 31 lookups", async () => {
    getPlanByDateSpy = vi.spyOn(db, "getPlanByDate").mockResolvedValue(null as any);
    listBlocksForPlanSpy = vi.spyOn(db, "listBlocksForPlan").mockResolvedValue([] as any);

    const got = await callWeekRange("2026-01-01", "2026-12-31");
    expect(Object.keys(got.byDate).length).toBe(31);
    expect(getPlanByDateSpy).toHaveBeenCalledTimes(31);
  });

  it("returns an empty map when end < start", async () => {
    getPlanByDateSpy = vi.spyOn(db, "getPlanByDate").mockResolvedValue(null as any);
    listBlocksForPlanSpy = vi.spyOn(db, "listBlocksForPlan").mockResolvedValue([] as any);

    const got = await callWeekRange("2026-06-10", "2026-06-01");
    expect(got.byDate).toEqual({});
    expect(getPlanByDateSpy).not.toHaveBeenCalled();
  });

  it("treats single-day windows correctly (start == end)", async () => {
    getPlanByDateSpy = vi.spyOn(db, "getPlanByDate").mockResolvedValue({ id: 7, date: "2026-06-01" } as any);
    listBlocksForPlanSpy = vi.spyOn(db, "listBlocksForPlan").mockResolvedValue([
      { id: 100, title: "Solo block", durationMin: 30, startTime: "10:00", planId: 7 },
    ] as any);

    const got = await callWeekRange("2026-06-01", "2026-06-01");
    expect(Object.keys(got.byDate)).toEqual(["2026-06-01"]);
    expect(got.byDate["2026-06-01"]).toHaveLength(1);
  });

  it("rejects malformed input with a Zod validation error", async () => {
    await expect(callWeekRange("not-a-date", "2026-06-01")).rejects.toThrow();
    await expect(callWeekRange("2026/06/01", "2026-06-01")).rejects.toThrow();
  });
});
