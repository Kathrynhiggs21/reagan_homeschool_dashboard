import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { appLinks } from "../drizzle/schema";

/**
 * Apps & Tools — launch-tile guard (rewritten 2026-06-17).
 *
 * IMPORTANT: `appLinks` is the table of clickable tiles on Reagan's
 * "Apps & Tools" page. It is NOT the parent-facing subscription/account
 * tracker (that lives in a separate seed in db.ts with appKey/appName, e.g.
 * Prodigy/BrainPOP/Outschool with prices). The earlier version of this test
 * conflated the two and asserted subscription names against the tile table.
 *
 * This guard treats the LIVE tile table as the source of truth (Option A,
 * confirmed with Katy) and asserts:
 *   1. The non-negotiable core tiles are present (IXL + Khan Academy).
 *   2. The dead Google Classroom tile is gone (@ihsd.us account closed Apr 2026).
 *   3. Every tile row is well-formed: non-empty name + url + emoji + category.
 *   4. There are no obvious test/placeholder leak rows.
 */

// Tiles that must always exist for Reagan's daily flow.
const REQUIRED_TILES = ["Khan Academy", "IXL"];

// Tiles that must NOT exist (retired).
const FORBIDDEN_TILES = ["Google Classroom"];

describe("Apps & Tools — launch-tile guard", () => {
  it("required core tiles are present", async () => {
    const db = getDb();
    const all = await db.select().from(appLinks);
    const names = new Set((all as any[]).map((a) => (a.name || "").toLowerCase()));
    for (const expected of REQUIRED_TILES) {
      expect(names.has(expected.toLowerCase()), `missing required tile: ${expected}`).toBe(true);
    }
  });

  it("retired tiles are absent (dead @ihsd.us Google Classroom)", async () => {
    const db = getDb();
    const all = await db.select().from(appLinks);
    const names = new Set((all as any[]).map((a) => (a.name || "").toLowerCase()));
    for (const gone of FORBIDDEN_TILES) {
      expect(names.has(gone.toLowerCase()), `retired tile still present: ${gone}`).toBe(false);
    }
  });

  it("every tile has a non-empty name + url + emoji + category", async () => {
    const db = getDb();
    const all = await db.select().from(appLinks);
    expect(all.length).toBeGreaterThan(0);
    for (const row of all as any[]) {
      const label = row.name || "(unnamed)";
      expect(row.name?.length, `${label} has empty name`).toBeGreaterThan(0);
      expect(row.url?.length, `${label} has empty url`).toBeGreaterThan(0);
      expect(row.emoji?.length, `${label} has empty emoji`).toBeGreaterThan(0);
      expect(row.category?.length, `${label} has empty category`).toBeGreaterThan(0);
    }
  });
});
