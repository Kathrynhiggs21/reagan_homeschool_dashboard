import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, getNextSchoolDays } from "./db";
import { sql } from "drizzle-orm";

/**
 * Push 2.11 (2026-05-17) — getNextSchoolDays helper.
 *
 * Real-DB vitest. We don't seed schoolCalendar by default (the table is
 * empty in dev), but we add 1 row temporarily inside one test to prove the
 * isOff lookup actually skips it, then clean it up.
 */

const TEST_OFF_DATE = "2099-09-09"; // far future, isolated, no real meaning
const TEST_OFF_LABEL = "vitest_2026-05-17_isOff_marker";

afterAll(async () => {
  const db = getDb();
  await db.execute(sql`
    DELETE FROM schoolCalendar WHERE label = ${TEST_OFF_LABEL}
  `);
});

describe("getNextSchoolDays", () => {
  it("returns 0 for count<=0", async () => {
    expect(await getNextSchoolDays("2027-09-13", 0)).toEqual([]);
    expect(await getNextSchoolDays("2027-09-13", -3)).toEqual([]);
  });

  it("returns weekdays only (skips Sat + Sun)", async () => {
    // 2027-09-13 is a Monday. Next 5 weekdays should be Mon..Fri 13–17.
    const out = await getNextSchoolDays("2027-09-13", 5);
    expect(out).toEqual([
      "2027-09-13",
      "2027-09-14",
      "2027-09-15",
      "2027-09-16",
      "2027-09-17",
    ]);
  });

  it("rolls past a weekend", async () => {
    // Start on a Friday, ask for 3 → Fri, then jump over Sat+Sun, then Mon, Tue.
    const out = await getNextSchoolDays("2027-09-17", 3);
    expect(out).toEqual([
      "2027-09-17", // Fri
      "2027-09-20", // Mon
      "2027-09-21", // Tue
    ]);
  });

  it("handles a Saturday start by jumping to Mon", async () => {
    // 2027-09-18 is a Saturday; first school day should be Mon 2027-09-20.
    const out = await getNextSchoolDays("2027-09-18", 1);
    expect(out).toEqual(["2027-09-20"]);
  });

  it("respects schoolCalendar.isOff = true entries", async () => {
    const db = getDb();
    // Insert a single off-day marker and confirm it's skipped.
    // 2099-09-09 is a Wednesday.
    await db.execute(sql`
      INSERT INTO schoolCalendar (date, isOff, label)
      VALUES (${TEST_OFF_DATE}, TRUE, ${TEST_OFF_LABEL})
      ON DUPLICATE KEY UPDATE isOff = TRUE
    `);
    // Start on 2099-09-08 (Tue), ask for 3 days. Without the off-day we'd get
    // Tue 09-08, Wed 09-09, Thu 09-10. With the off-day we should get
    // Tue 09-08, Thu 09-10, Fri 09-11.
    const out = await getNextSchoolDays("2099-09-08", 3);
    expect(out).toEqual(["2099-09-08", "2099-09-10", "2099-09-11"]);
  });

  it("never returns a date earlier than start", async () => {
    const start = "2027-09-13";
    const out = await getNextSchoolDays(start, 10);
    for (const d of out) expect(d >= start).toBe(true);
  });

  it("returns exactly count entries when there are enough school days available", async () => {
    const out = await getNextSchoolDays("2027-09-13", 10);
    expect(out).toHaveLength(10);
  });
});
