import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

describe("AI Schedule Generator wiring", () => {
  it("Today.tsx mounts AIScheduleGeneratorCard inside the adult drawer", () => {
    // v3.28 (2026-06-01): adult cards moved into a single drawer slice.
    const src = readFileSync(join(root, "client/src/pages/Today.tsx"), "utf8");
    expect(src).toContain("AIScheduleGeneratorCard");
    const gateIdx = src.indexOf("{unlocked && (");
    expect(gateIdx).toBeGreaterThan(0);
    const slice = src.slice(gateIdx, gateIdx + 8000);
    expect(slice).toContain("<AIScheduleGeneratorCard");
  });

  it("plans router exposes aiGenerate and aiCommit", () => {
    const src = readFileSync(join(root, "server/routers.ts"), "utf8");
    // May 11 2026: gate moved from protectedProcedure to familyAdminProcedure.
    expect(src).toMatch(/aiGenerate\s*:\s*(?:protectedProcedure|familyAdminProcedure)/);
    expect(src).toMatch(/aiCommit\s*:\s*(?:protectedProcedure|familyAdminProcedure)/);
  });

  it("AIScheduleGeneratorCard component file exists and uses both procedures", () => {
    const src = readFileSync(join(root, "client/src/components/AIScheduleGeneratorCard.tsx"), "utf8");
    expect(src).toContain("trpc.plans.aiGenerate");
    expect(src).toContain("trpc.plans.aiCommit");
  });
});
