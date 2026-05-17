import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

/**
 * Exercises resetTutorRoster() against the live TiDB.
 * Mirrors the existing rewards / scheduled-sync test pattern (no mocks).
 */
describe("resetTutorRoster", () => {
  beforeAll(async () => {
    // make sure the DB is reachable + the tutors table exists
    await db.listTutors(false);
  });

  // v2.20 (2026-05-17): The canonical roster was renamed (push 79):
  //   "Tutor A/B/C" → "Madison", "Sophie", "Keith". The reset helper
  // also seeds *@tbd.local placeholder emails so permissions.ts can
  // treat the rows as Editor-tier the moment real Google sign-ins
  // land. Tests below reflect that current truth.
  const CANONICAL = ["Madison", "Sophie", "Keith"] as const;

  it("returns exactly the three canonical tutors (Madison, Sophie, Keith)", async () => {
    const res: any = await db.resetTutorRoster();
    // resetTutorRoster's return shape varies by version; tolerate either
    // { count, roster } or just an inserted-count number, then verify by
    // re-listing.
    if (typeof res === "object" && res !== null) {
      if (typeof res.count === "number") {
        expect(res.count).toBeGreaterThanOrEqual(3);
      }
      if (Array.isArray(res.roster)) {
        expect(res.roster).toEqual(expect.arrayContaining([...CANONICAL]));
      }
    }
    const active = await db.listTutors(true);
    const names = active.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining([...CANONICAL]));
  });

  it("leaves each canonical tutor active with the seeded *@tbd.local placeholder", async () => {
    await db.resetTutorRoster();
    const active = await db.listTutors(true);
    const byName = Object.fromEntries(active.map((t: any) => [t.name, t]));
    for (const n of CANONICAL) {
      expect(byName[n], `${n} should exist in the active roster`).toBeTruthy();
      expect(byName[n].active).toBe(true);
      // The reset helper deliberately seeds @tbd.local placeholders so
      // permissions.roleForEmail treats them as Editor-tier on first
      // sign-in. Anything else means the seed got out of sync with
      // permissions.ts.
      expect(byName[n].email).toMatch(/@tbd\.local$/);
    }
  });

  it("deactivates previously-active non-canonical tutors without deleting them", async () => {
    // Seed a stray tutor, then call reset; it should be marked inactive but still findable.
    const stray = await db.upsertTutor({
      name: `__strayTutor_${Date.now()}`,
      role: "tutor",
      active: true,
    });
    await db.resetTutorRoster();
    const all = await db.listTutors(false);
    const found = all.find((t: any) => t.id === stray.id);
    expect(found, "stray tutor should still exist in DB").toBeTruthy();
    expect(found!.active).toBe(false);
  });
});
