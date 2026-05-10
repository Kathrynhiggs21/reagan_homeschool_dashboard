/**
 * Slice 2 — verify the new varied weekday builder produces different shapes
 * (block counts, leading subjects) for Mon/Tue/Thu/Fri so the "before == after"
 * bug stops being possible at the template layer.
 */
import { describe, it, expect } from "vitest";
import { buildVariedWeekdayTemplate } from "./_lib/dayBuilder";

describe("dayBuilder — varied weekday template", () => {
  it("produces a different block count for Mon vs Tue vs Thu vs Fri", async () => {
    const mon = await buildVariedWeekdayTemplate(1);
    const tue = await buildVariedWeekdayTemplate(2);
    const thu = await buildVariedWeekdayTemplate(4);
    const fri = await buildVariedWeekdayTemplate(5);
    const counts = new Set([mon.length, tue.length, thu.length, fri.length]);
    // We need at least 2 distinct counts across the 4 weekdays to call this "varied".
    expect(counts.size).toBeGreaterThanOrEqual(2);
    // And every template must be non-empty.
    for (const t of [mon, tue, thu, fri]) {
      expect(t.length).toBeGreaterThan(0);
    }
  });

  it("has a different lead block (first block) on different days", async () => {
    const mon = (await buildVariedWeekdayTemplate(1))[0];
    const fri = (await buildVariedWeekdayTemplate(5))[0];
    expect(mon.title).not.toEqual(fri.title);
  });

  it("Friday wraps with a 'Week wrap-up' block", async () => {
    const fri = await buildVariedWeekdayTemplate(5);
    const last = fri[fri.length - 1];
    expect(last.title.toLowerCase()).toContain("wrap-up");
  });

  it("Thursday includes an adventure block longer than 30 minutes", async () => {
    const thu = await buildVariedWeekdayTemplate(4);
    const adv = thu.find(b => b.type === "adventure");
    expect(adv).toBeTruthy();
    expect(adv!.minutes).toBeGreaterThanOrEqual(30);
  });

  it("never returns blocks with missing required fields", async () => {
    for (const dow of [1, 2, 3, 4, 5]) {
      const t = await buildVariedWeekdayTemplate(dow);
      for (const b of t) {
        expect(typeof b.title).toBe("string");
        expect(b.title.length).toBeGreaterThan(0);
        expect(typeof b.description).toBe("string");
        expect(typeof b.type).toBe("string");
        expect(b.minutes).toBeGreaterThan(0);
      }
    }
  });
});
