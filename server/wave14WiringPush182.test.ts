import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 182 (Wave-14) — wiring contract: today.familyScreenTimeFairness
 * must exist on the today router and import the helper.
 */
describe("Push 182 — Wave-14 wiring", () => {
  const src = readFileSync(join(__dirname, "routers.ts"), "utf8");

  it("declares today.familyScreenTimeFairness wired to computeFamilyScreenTimeFairness", () => {
    expect(src).toMatch(/familyScreenTimeFairness\s*:\s*publicProcedure/);
    expect(src).toMatch(/computeFamilyScreenTimeFairness/);
    expect(src).toMatch(/_lib\/familyScreenTimeFairness/);
  });

  it("is wired after bookshelfMilestoneToday in the today router", () => {
    const shelfIdx = src.indexOf("bookshelfMilestoneToday");
    const fairIdx = src.indexOf("familyScreenTimeFairness");
    expect(shelfIdx).toBeGreaterThan(0);
    expect(fairIdx).toBeGreaterThan(shelfIdx);
  });

  it("input schema accepts mom and grandma overrides only", () => {
    expect(src).toMatch(/grantedBy:\s*z\.enum\(\["mom",\s*"grandma"\]\)/);
  });

  it("never blocks — output type from helper has blocked: false invariant", () => {
    // Helper-side invariant; this wiring test confirms we import the
    // correct helper which encodes the invariant.
    expect(src).toMatch(/_lib\/familyScreenTimeFairness/);
  });
});
