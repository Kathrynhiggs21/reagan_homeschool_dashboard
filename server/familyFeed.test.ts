import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

/**
 * Smoke test for the unified family feed.
 * Doesn't try to seed events \u2014 just calls listFamilyFeed and asserts the
 * shape so future refactors can't drop required fields.
 */
describe("familyFeed.list contract", () => {
  let items: any[] = [];

  beforeAll(async () => {
    items = await db.listFamilyFeed(20);
  });

  it("returns an array (possibly empty if DB has no events)", () => {
    expect(Array.isArray(items)).toBe(true);
  });

  it("each item has the required shape", () => {
    for (const it of items) {
      expect(typeof it.id).toBe("string");
      expect(["block_complete", "submission", "good_work_note", "coin_earn"]).toContain(it.kind);
      expect(it.at instanceof Date || typeof it.at === "string").toBe(true);
      expect(typeof it.title).toBe("string");
      expect(it.title.length).toBeGreaterThan(0);
      expect(typeof it.refId).toBe("number");
    }
  });

  it("is sorted descending by timestamp", () => {
    for (let i = 1; i < items.length; i++) {
      const prev = new Date(items[i - 1].at).getTime();
      const cur = new Date(items[i].at).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("respects the limit", async () => {
    const small = await db.listFamilyFeed(3);
    expect(small.length).toBeLessThanOrEqual(3);
  });
});
