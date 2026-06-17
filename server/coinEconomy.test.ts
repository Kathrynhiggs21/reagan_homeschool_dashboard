/**
 * Coin economy — "coins for everything Reagan does" (2026-06-17).
 *
 * Covers the positive-only / idempotent award helpers added to server/db.ts:
 *   - computeCoinAward   (pure: difficulty + time → coins, clamped 1..40)
 *   - inferDifficulty    (pure: minutes/kind → easy|medium|hard)
 *   - awardSubmissionCoins (idempotent per submission)
 *   - awardOnTimeBonus     (idempotent per date)
 *   - awardFullDayBonus    (idempotent per date)
 *   - awardDayBonus        (positive-only difference; never subtracts)
 *   - awardManualCoins     (amount clamp 1..200; each call is its own entry)
 *
 * The DB-backed tests run against the live test database. Every row they
 * create carries a unique `[src=...]` tag inside a recognizable test prefix,
 * and `afterAll` deletes exactly those rows so no synthetic data is left in
 * the coin ledger.
 */
import { describe, it, expect, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import {
  computeCoinAward,
  inferDifficulty,
  awardSubmissionCoins,
  awardOnTimeBonus,
  awardFullDayBonus,
  awardDayBonus,
  awardManualCoins,
  getDb,
} from "./db";
import { coinLedger } from "../drizzle/schema";

// A unique marker shared by every row this file creates, so cleanup is exact.
const RUN = `cointest_${Date.now()}`;
const MARK = `[cointest:${RUN}]`;

afterAll(async () => {
  // Remove every ledger row this test run inserted (matched by our marker).
  const db = getDb();
  await db.delete(coinLedger).where(sql`${coinLedger.reasonNote} LIKE ${"%" + MARK + "%"}`);
});

describe("computeCoinAward (pure)", () => {
  it("base award with no difficulty/time is 5 coins", () => {
    expect(computeCoinAward({})).toBe(5);
    expect(computeCoinAward({ difficulty: null, minutes: null })).toBe(5);
  });

  it("difficulty multipliers: easy x1, medium x1.5, hard x2 (rounded base)", () => {
    expect(computeCoinAward({ difficulty: "easy", minutes: 0 })).toBe(5); // 5*1
    expect(computeCoinAward({ difficulty: "medium", minutes: 0 })).toBe(8); // round(7.5)
    expect(computeCoinAward({ difficulty: "hard", minutes: 0 })).toBe(10); // 5*2
  });

  it("time bonus adds +1 per ~10 minutes, capped at +10", () => {
    expect(computeCoinAward({ difficulty: "easy", minutes: 10 })).toBe(6); // 5 + 1
    expect(computeCoinAward({ difficulty: "easy", minutes: 25 })).toBe(7); // 5 + floor(2.5)=2
    // huge minutes clamp the minute input at 120 → +10 max, then total clamps at 40
    expect(computeCoinAward({ difficulty: "easy", minutes: 9999 })).toBe(15); // 5 + 10
  });

  it("clamps the final result to 1..40", () => {
    // hard (10) + max time bonus (10) = 20, still under 40
    expect(computeCoinAward({ difficulty: "hard", minutes: 120 })).toBe(20);
    // never below 1 even for degenerate inputs
    expect(computeCoinAward({ difficulty: "easy", minutes: -50 })).toBeGreaterThanOrEqual(1);
    // never above 40
    expect(computeCoinAward({ difficulty: "hard", minutes: 100000 })).toBeLessThanOrEqual(40);
  });
});

describe("inferDifficulty (pure)", () => {
  it("quiz/assessment/test kinds are always hard", () => {
    expect(inferDifficulty({ minutes: 5, kind: "quiz" })).toBe("hard");
    expect(inferDifficulty({ minutes: 5, kind: "assessment" })).toBe("hard");
    expect(inferDifficulty({ minutes: 5, kind: "TEST-out" })).toBe("hard");
  });

  it("buckets by minutes when kind is neutral", () => {
    expect(inferDifficulty({ minutes: 10 })).toBe("easy");
    expect(inferDifficulty({ minutes: 20 })).toBe("medium");
    expect(inferDifficulty({ minutes: 45 })).toBe("hard");
    expect(inferDifficulty({})).toBe("easy");
  });
});

describe("awardSubmissionCoins (idempotent per submission)", () => {
  it("pays once and returns 0 on re-run for the same submission", async () => {
    // Encode our run marker in the label so it lands in reasonNote for cleanup.
    const submissionId = Number(`${Date.now()}`.slice(-9)); // unlikely to collide
    const label = `Finished an assignment ${MARK}`;
    const first = await awardSubmissionCoins({
      userId: null,
      submissionId,
      difficulty: "medium",
      minutes: 20,
      label,
    });
    expect(first).toBeGreaterThan(0);
    expect(first).toBe(computeCoinAward({ difficulty: "medium", minutes: 20 }));

    const second = await awardSubmissionCoins({
      userId: null,
      submissionId,
      difficulty: "medium",
      minutes: 20,
      label,
    });
    expect(second).toBe(0);
  });
});

describe("awardOnTimeBonus / awardFullDayBonus (idempotent per date)", () => {
  it("on-time bonus is granted once per date, clamped 1..20", async () => {
    const date = `cointest-${RUN}-A`;
    const first = await awardOnTimeBonus({ userId: null, date, coins: 5 });
    expect(first).toBe(5);
    const second = await awardOnTimeBonus({ userId: null, date, coins: 5 });
    expect(second).toBe(0);
  });

  it("on-time bonus clamps coins into 1..20", async () => {
    const date = `cointest-${RUN}-B`;
    const v = await awardOnTimeBonus({ userId: null, date, coins: 9999 });
    expect(v).toBe(20);
  });

  it("full-day bonus is granted once per date, clamped 1..40", async () => {
    const date = `cointest-${RUN}-C`;
    const first = await awardFullDayBonus({ userId: null, date, coins: 10 });
    expect(first).toBe(10);
    const second = await awardFullDayBonus({ userId: null, date, coins: 10 });
    expect(second).toBe(0);
  });
});

describe("awardDayBonus (positive-only difference logic)", () => {
  it("awards the full target the first time", async () => {
    const date = `cointest-${RUN}-D`;
    const v = await awardDayBonus({ userId: null, date, concentration: 2, attitude: 1 });
    expect(v).toBe(3); // 2 + 1
  });

  it("re-running with the same ratings awards 0 (no double pay)", async () => {
    const date = `cointest-${RUN}-E`;
    expect(await awardDayBonus({ userId: null, date, concentration: 3, attitude: 3 })).toBe(6);
    expect(await awardDayBonus({ userId: null, date, concentration: 3, attitude: 3 })).toBe(0);
  });

  it("increasing the rating awards only the positive delta", async () => {
    const date = `cointest-${RUN}-F`;
    expect(await awardDayBonus({ userId: null, date, concentration: 1, attitude: 1 })).toBe(2);
    expect(await awardDayBonus({ userId: null, date, concentration: 3, attitude: 2 })).toBe(3); // 5 - 2
  });

  it("decreasing the rating never subtracts (awards 0)", async () => {
    const date = `cointest-${RUN}-G`;
    expect(await awardDayBonus({ userId: null, date, concentration: 3, attitude: 3 })).toBe(6);
    expect(await awardDayBonus({ userId: null, date, concentration: 0, attitude: 0 })).toBe(0);
  });

  it("clamps each rating into 0..3", async () => {
    const date = `cointest-${RUN}-H`;
    // 99 and 99 clamp to 3 + 3 = 6
    expect(await awardDayBonus({ userId: null, date, concentration: 99, attitude: 99 })).toBe(6);
  });
});

describe("awardManualCoins (clamp + per-call entry)", () => {
  it("clamps the amount into 1..200", async () => {
    const big = await awardManualCoins({
      userId: null,
      amount: 9999,
      reason: `Big grant ${MARK}`,
      grantedByName: "Mom",
    });
    expect(big).toBe(200);

    const small = await awardManualCoins({
      userId: null,
      amount: -50,
      reason: `Tiny grant ${MARK}`,
      grantedByName: "Grandma",
    });
    expect(small).toBe(1);
  });

  it("each call creates a distinct entry (not idempotent by design)", async () => {
    const a = await awardManualCoins({ userId: null, amount: 7, reason: `Helped clean ${MARK}` });
    const b = await awardManualCoins({ userId: null, amount: 7, reason: `Helped clean ${MARK}` });
    expect(a).toBe(7);
    expect(b).toBe(7);
    // Both rows should now exist with our marker.
    const db = getDb();
    const rows: any = await db
      .select()
      .from(coinLedger)
      .where(sql`${coinLedger.reasonNote} LIKE ${"%Helped clean " + MARK + "%"}`);
    expect((rows as any[]).length).toBeGreaterThanOrEqual(2);
  });
});
