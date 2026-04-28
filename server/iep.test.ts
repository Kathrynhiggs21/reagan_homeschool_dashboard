import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("IEP endpoints", () => {
  it("listIepGoals returns the 6 seeded goals from the 2025-26 IEP", async () => {
    const goals = await db.listIepGoals();
    expect(Array.isArray(goals)).toBe(true);
    expect(goals.length).toBeGreaterThanOrEqual(6);
    // At least one reading, one math, one writing goal
    const areas = new Set(goals.map((g: any) => g.area));
    expect(areas.has("reading")).toBe(true);
    expect(areas.has("math")).toBe(true);
    expect(areas.has("writing")).toBe(true);
    // Each goal should carry a source file reference back to the IEP PDF
    const withSource = goals.filter((g: any) => g.sourceFileKey || g.sourceFileName);
    expect(withSource.length).toBeGreaterThan(0);
  });

  it("listIepAccommodations returns at least 6 active accommodations", async () => {
    const accoms = await db.listIepAccommodations();
    expect(Array.isArray(accoms)).toBe(true);
    expect(accoms.length).toBeGreaterThanOrEqual(6);
    // All should be marked active
    expect(accoms.every((a: any) => a.active === true || a.active === 1)).toBe(true);
    // Categories should include presentation / response / timing / setting / behavior mix
    const cats = new Set(accoms.map((a: any) => a.category));
    expect(cats.size).toBeGreaterThanOrEqual(3);
  });
});
