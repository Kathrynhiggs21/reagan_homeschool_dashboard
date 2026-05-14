import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 183 (Wave-15) — wiring contract: today.pearClassesAppLink
 * must exist on the today router and import the helper.
 */
describe("Push 183 — Wave-15 wiring", () => {
  const src = readFileSync(join(__dirname, "routers.ts"), "utf8");

  it("declares today.pearClassesAppLink as a publicProcedure", () => {
    expect(src).toMatch(/pearClassesAppLink\s*:\s*publicProcedure/);
  });

  it("imports computePearClassesAppLink from the helper module", () => {
    expect(src).toMatch(/computePearClassesAppLink/);
    expect(src).toMatch(/_lib\/pearClassesAppLink/);
  });

  it("input schema includes the three optional fields", () => {
    expect(src).toMatch(/signedInGoogleAccount\s*:\s*z\.string\(\)/);
    expect(src).toMatch(/oauthConsentGranted\s*:\s*z\.boolean\(\)/);
    expect(src).toMatch(/isReaganView\s*:\s*z\.boolean\(\)/);
  });

  it("is wired after familyScreenTimeFairness in the today router", () => {
    const fairIdx = src.indexOf("familyScreenTimeFairness");
    const pearIdx = src.indexOf("pearClassesAppLink");
    expect(fairIdx).toBeGreaterThan(0);
    expect(pearIdx).toBeGreaterThan(fairIdx);
  });
});
