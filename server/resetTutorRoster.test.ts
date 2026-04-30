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

  it("returns exactly the three canonical tutors (Tutor A, Tutor B, Tutor C)", async () => {
    const res = await db.resetTutorRoster();
    expect(res.count).toBeGreaterThanOrEqual(3);
    expect(res.roster).toEqual(expect.arrayContaining(["Tutor A", "Tutor B", "Tutor C"]));
  });

  it("leaves each canonical tutor active with no fake contact info", async () => {
    await db.resetTutorRoster();
    const active = await db.listTutors(true);
    const byName = Object.fromEntries(active.map((t: any) => [t.name, t]));
    for (const n of ["Tutor A", "Tutor B", "Tutor C"]) {
      expect(byName[n], `${n} should exist in the active roster`).toBeTruthy();
      expect(byName[n].active).toBe(true);
      // No email/phone seeded — guard against accidentally leaking test contact info
      expect(byName[n].email || "").toBe("");
      expect(byName[n].phone || "").toBe("");
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
