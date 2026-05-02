import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract test: aiGenerate must short-circuit when called for a Sat/Sun
 * date unless the adult explicitly passes allowWeekend:true.
 */
describe("aiGenerate weekend guard \u2014 contract", () => {
  const root = join(__dirname, "..");

  it("aiGenerate accepts an allowWeekend flag", () => {
    const src = readFileSync(join(root, "server/routers.ts"), "utf8");
    expect(src).toMatch(/aiGenerate:\s*protectedProcedure[\s\S]*?allowWeekend:\s*z\.boolean\(\)\.optional\(\)/);
  });

  it("aiGenerate returns weekendBlocked:true for weekend dates without override", () => {
    const src = readFileSync(join(root, "server/routers.ts"), "utf8");
    expect(src).toMatch(/isWeekendDate\(input\.date\)\s*&&\s*!input\.allowWeekend/);
    expect(src).toContain("weekendBlocked");
  });

  it("aiCommit accepts an allowWeekend flag too", () => {
    const src = readFileSync(join(root, "server/routers.ts"), "utf8");
    expect(src).toMatch(/aiCommit:\s*protectedProcedure[\s\S]*?allowWeekend:\s*z\.boolean\(\)\.optional\(\)/);
  });
});
