import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

describe("AI Schedule Generator wiring", () => {
  it("Today.tsx mounts AIScheduleGeneratorCard behind the adult unlock", () => {
    const src = readFileSync(join(root, "client/src/pages/Today.tsx"), "utf8");
    expect(src).toContain("AIScheduleGeneratorCard");
    expect(src).toMatch(/unlocked\s*&&\s*\(\s*<AIScheduleGeneratorCard/);
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
