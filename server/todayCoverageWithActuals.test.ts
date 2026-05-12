import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { todayCoverageWithActuals } from "./db";

describe("todayCoverageWithActuals — Slice 4.5 actual-vs-planned source-of-truth flip", () => {
  it("returns an array (DB-shaped, may be empty in test env)", async () => {
    const rows = await todayCoverageWithActuals();
    expect(Array.isArray(rows)).toBe(true);
    for (const r of rows) {
      expect(r).toHaveProperty("subjectSlug");
      expect(r).toHaveProperty("plannedTotal");
      expect(r).toHaveProperty("plannedDone");
      expect(r).toHaveProperty("plannedPct");
      expect(r).toHaveProperty("actualEntries");
      expect(r).toHaveProperty("actualMinutes");
      expect(r).toHaveProperty("effectivePct");
      expect(r).toHaveProperty("offPlan");
      expect(typeof r.effectivePct).toBe("number");
      expect(r.effectivePct).toBeGreaterThanOrEqual(0);
      expect(r.effectivePct).toBeLessThanOrEqual(100);
    }
  });
});

describe("todayCoverageWithActuals — wiring", () => {
  const dbSrc = readFileSync(resolve(__dirname, "db.ts"), "utf8");
  const routerSrc = readFileSync(resolve(__dirname, "routers.ts"), "utf8");

  it("function reads from listActualForDate (not just scheduleBlocks)", () => {
    expect(dbSrc).toMatch(/export async function todayCoverageWithActuals/);
    expect(dbSrc).toMatch(/await listActualForDate\(today\)/);
  });

  it("merges planned + actual into effectivePct", () => {
    expect(dbSrc).toMatch(/effectivePct/);
    expect(dbSrc).toMatch(/effectiveCovered = Math\.min\(p\.total, p\.done \+ a\.entries\)/);
  });

  it("flags off-plan subjects (actuals with no planned block)", () => {
    expect(dbSrc).toMatch(/offPlan: true/);
    expect(dbSrc).toMatch(/plannedSlugs\.has\(slug\)/);
  });

  it("today.coverageWithActuals tRPC procedure is registered", () => {
    expect(routerSrc).toMatch(/coverageWithActuals: protectedProcedure\.query\(\(\) => db\.todayCoverageWithActuals\(\)\)/);
  });
});
