import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { appLinks } from "../drizzle/schema";

/**
 * Phase 6 — Apps & Tools prune guard.
 *
 * Asserts only the canonical "actually-used" apps are present.
 * (We do NOT assert "no leaked Test rows" here because newFeatures.test.ts
 *  intentionally creates+deletes Test App rows; vitest runs files in parallel,
 *  so a leak guard would race with that test by design.)
 */

const CANONICAL_NAMES = [
  "Khan Academy",
  "IXL",
  "Prodigy Math",
  "BrainPOP",
  "Edpuzzle",
  "Vocabulary.com",
  // Google Classroom removed — school @ihsd.us account dead (Apr 2026 exit)
  "Google Docs",
  "Google Drive",
  "Gmail",
  "Epic! Books",
  "CommonLit",
  "Math Antics",
  "Crash Course Kids",
  "Mystery Doug",
  "Merlin Bird ID",
  "iNaturalist",
  "Roblox",
  "Minecraft",
  "Toca Boca",
];

describe("Apps & Tools — canonical 'actually-used' set", () => {
  it("all canonical apps are present in appLinks", async () => {
    const db = getDb();
    const all = await db.select().from(appLinks);
    const names = new Set((all as any[]).map((a) => (a.name || "").toLowerCase()));
    for (const expected of CANONICAL_NAMES) {
      expect(names.has(expected.toLowerCase()), `missing canonical app: ${expected}`).toBe(true);
    }
  });

  it("each canonical app has a non-empty url + emoji + category", async () => {
    const db = getDb();
    const all = await db.select().from(appLinks);
    for (const expected of CANONICAL_NAMES) {
      const row = (all as any[]).find((a) => (a.name || "").toLowerCase() === expected.toLowerCase());
      expect(row, `${expected} not found`).toBeTruthy();
      expect(row.url?.length, `${expected} has empty url`).toBeGreaterThan(0);
      expect(row.emoji?.length, `${expected} has empty emoji`).toBeGreaterThan(0);
      expect(row.category?.length, `${expected} has empty category`).toBeGreaterThan(0);
    }
  });
});
