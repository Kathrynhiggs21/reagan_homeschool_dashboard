import { describe, it, expect } from "vitest";
import * as db from "./db";

/**
 * Exercises the sticker + coin economy end-to-end against the live TiDB.
 * Uses a throw-away userId (99999001) to keep real data clean.
 */

const TEST_USER = 99999001;

describe("rewards economy", () => {
  it("awardSticker inserts a sticker + coin row and coinBalance reflects it", async () => {
    const startBal = (await db.coinBalance(TEST_USER)).balance;

    const result = await db.awardSticker({
      userId: TEST_USER,
      reason: "block_done",
      coins: 1,
      blockId: null,
    });

    expect(result.stickerId).toBeTruthy();
    expect(result.coins).toBe(1);
    expect(result.art).toBeTruthy();

    const endBal = (await db.coinBalance(TEST_USER)).balance;
    expect(endBal).toBe(startBal + 1);

    const myStickers = await db.listStickers(TEST_USER);
    expect(myStickers.length).toBeGreaterThan(0);
    expect(myStickers.some((s: any) => s.id === result.stickerId)).toBe(true);
  });

  it("seedDefaultPrizesIfEmpty populates the catalog on first run, idempotent on second", async () => {
    const first = await db.seedDefaultPrizesIfEmpty();
    // Either seeded fresh (first run) or found existing — but always returns a result
    expect(first).toHaveProperty("seeded");

    const prizes = await db.listPrizes(true);
    expect(prizes.length).toBeGreaterThan(0);
    expect(prizes.every((p: any) => typeof p.coinCost === "number" && p.coinCost > 0)).toBe(true);

    // Second call MUST be a no-op
    const second = await db.seedDefaultPrizesIfEmpty();
    expect(second.seeded).toBe(false);
  });

  it("requestPrize deducts coins from the ledger and creates a pending redemption", async () => {
    // Stuff the test user with enough coins to afford the cheapest prize
    for (let i = 0; i < 40; i++) {
      await db.awardSticker({ userId: TEST_USER, reason: "adult_bonus", coins: 1 });
    }

    const prizes = await db.listPrizes(true);
    const cheapest = [...prizes].sort((a: any, b: any) => a.coinCost - b.coinCost)[0];
    expect(cheapest).toBeTruthy();

    const beforeBal = (await db.coinBalance(TEST_USER)).balance;
    const req = await db.requestPrize(TEST_USER, cheapest.id);
    expect(req.status).toBe("pending");

    const afterBal = (await db.coinBalance(TEST_USER)).balance;
    expect(afterBal).toBe(beforeBal - cheapest.coinCost);

    const reds = await db.listMyRedemptions(TEST_USER);
    expect(reds.some((r: any) => r.id === req.redemptionId && r.status === "pending")).toBe(true);
  });

  it("requestPrize rejects when the balance is not enough", async () => {
    const tooPoorUser = 99999002;
    const prizes = await db.listPrizes(true);
    const pricey = [...prizes].sort((a: any, b: any) => b.coinCost - a.coinCost)[0];
    await expect(db.requestPrize(tooPoorUser, pricey.id)).rejects.toThrow(/coins/i);
  });
});
