/**
 * v2.28 (2026-05-17) — Reagan must not be able to flip Summer Mode (or any
 * KV setting) on herself via prefs.set. The Mom-side SummerModeSettingsCard
 * shipped in Push 72 calls prefs.set, and prefs.set was protectedProcedure,
 * which means *any* signed-in account — including Reagan — could write to
 * any of the 64-char-key KV settings. This test locks the v2.28 tightening:
 * prefs.set is now familyAdminProcedure, so Reagan gets FORBIDDEN.
 *
 * Source-pattern only — no real DB writes — to keep this fast and skip-safe
 * if the underlying KV setup ever moves around.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS_PATH = join(__dirname, "routers.ts");
const ROUTERS = readFileSync(ROUTERS_PATH, "utf8");

describe("v2.28 — prefs.set is familyAdminProcedure (Reagan cannot flip Summer Mode)", () => {
  it("prefs.set uses familyAdminProcedure, not protectedProcedure", () => {
    // Find the prefs router block.
    const prefsBlock = ROUTERS.match(/prefs:\s*router\(\{[\s\S]*?\n\s{2}\}\),/);
    expect(prefsBlock, "prefs router block must exist in routers.ts").toBeTruthy();
    const block = prefsBlock![0];

    // Inside the prefs block, the `set:` procedure must be familyAdminProcedure.
    const setLine = block.match(/set:\s*(\w+Procedure)/);
    expect(setLine, "prefs.set must be assigned a *Procedure").toBeTruthy();
    expect(setLine![1]).toBe("familyAdminProcedure");
  });

  it("prefs.get stays protectedProcedure (Reagan still reads non-secret prefs)", () => {
    const prefsBlock = ROUTERS.match(/prefs:\s*router\(\{[\s\S]*?\n\s{2}\}\),/);
    const block = prefsBlock![0];
    const getLine = block.match(/get:\s*(\w+Procedure)/);
    expect(getLine).toBeTruthy();
    expect(getLine![1]).toBe("protectedProcedure");
  });

  it("prefs.getPublic stays publicProcedure (UI reads with allowlist)", () => {
    const prefsBlock = ROUTERS.match(/prefs:\s*router\(\{[\s\S]*?\n\s{2}\}\),/);
    const block = prefsBlock![0];
    const getPublicLine = block.match(/getPublic:\s*(\w+Procedure)/);
    expect(getPublicLine).toBeTruthy();
    expect(getPublicLine![1]).toBe("publicProcedure");
  });

  it("prefs.list stays protectedProcedure (Mom inspects KV from settings)", () => {
    const prefsBlock = ROUTERS.match(/prefs:\s*router\(\{[\s\S]*?\n\s{2}\}\),/);
    const block = prefsBlock![0];
    const listLine = block.match(/list:\s*(\w+Procedure)/);
    expect(listLine).toBeTruthy();
    expect(listLine![1]).toBe("protectedProcedure");
  });

  it("the v2.28 tightening comment is in place above the set procedure", () => {
    const prefsBlock = ROUTERS.match(/prefs:\s*router\(\{[\s\S]*?\n\s{2}\}\),/);
    const block = prefsBlock![0];
    // The comment should explicitly call out v2.28 and the date so it survives
    // future refactors as a tombstone.
    expect(block).toMatch(/v2\.28[^\n]*tightened from protectedProcedure to familyAdminProcedure/);
    expect(block).toMatch(/Reagan should never be able to flip Summer Mode/);
  });

  it("familyAdminProcedure is imported in routers.ts (prerequisite for the gate)", () => {
    // Defense-in-depth: if the gate symbol disappears from the import line, this
    // test fails loud rather than letting the production gate silently degrade.
    expect(ROUTERS).toMatch(/import\s*\{[^}]*familyAdminProcedure[^}]*\}\s*from\s*["']\.\/_core\/trpc["']/);
  });
});
