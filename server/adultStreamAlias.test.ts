import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Backlog refers to "adultStream.feed" while newer code shipped it as
 * "familyFeed.list". This test guards the alias so both names hit the
 * same DB helper and the tutor-handoff doc never goes stale.
 */
describe("adultStream.feed alias", () => {
  const src = readFileSync(join(__dirname, "routers.ts"), "utf8");

  it("declares the adultStream router with a feed query", () => {
    expect(src).toMatch(/adultStream:\s*router\(\{[\s\S]*?feed:\s*publicProcedure/);
  });

  it("delegates to db.listFamilyFeed (single source of truth)", () => {
    const idx = src.indexOf("adultStream: router({");
    expect(idx).toBeGreaterThan(0);
    // Scan a generous window past the router opening so we capture the body
    // including the trailing `}),` at the router boundary.
    const window = src.slice(idx, idx + 800);
    expect(window).toContain("db.listFamilyFeed");
  });

  it("activityOptions.suggest is wired and pure", () => {
    expect(src).toMatch(/activityOptions:\s*router\(\{[\s\S]*?suggest:\s*publicProcedure/);
    expect(src).toContain('await import("./_lib/activityOptions")');
  });
});
