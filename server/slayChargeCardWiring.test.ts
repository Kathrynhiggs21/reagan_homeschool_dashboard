/**
 * Push 119 (2026-05-13) — Slay Charge ⚡ render-card wiring contract.
 *
 * Locks in:
 *   - tRPC procedure today.slayCharge exists and is wired to the pure helper
 *   - Today.tsx imports SlayChargeCard
 *   - Today.tsx mounts SlayChargeCard only inside the morning_vibe block
 *   - Recent Submissions filter still references morning_vibe / Slay Charge
 *
 * The actual pure picker is covered separately by
 * slayChargeMorningVibe.test.ts. This is a wiring invariant.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(__dirname, "..");
function read(rel: string): string {
  return readFileSync(join(PROJECT_ROOT, rel), "utf8");
}

describe("Push 119 — Slay Charge ⚡ Today-card wiring", () => {
  it("server/routers.ts registers today.slayCharge procedure", () => {
    const src = read("server/routers.ts");
    expect(src).toMatch(/slayCharge:\s*publicProcedure/);
  });

  it("today.slayCharge procedure imports the pure picker from _lib", () => {
    const src = read("server/routers.ts");
    // It's a dynamic import inside the resolver, so the order is reversed:
    //   const { pickSlayChargeForDay } = await import("./_lib/slayChargeMorningVibe");
    expect(src).toMatch(
      /import\(\s*["']\.\/_lib\/slayChargeMorningVibe["']\s*\)/,
    );
    expect(src).toMatch(/pickSlayChargeForDay/);
  });

  it("today.slayCharge procedure passes (dateIso, rerollIndex) to the picker", () => {
    const src = read("server/routers.ts");
    // The block of code that calls the picker should mention both.
    const sliceMatch = src.match(/pickSlayChargeForDay\(\{[\s\S]{0,200}?\}\)/);
    expect(sliceMatch).toBeTruthy();
    const slice = sliceMatch![0];
    expect(slice).toMatch(/dateIso/);
    expect(slice).toMatch(/rerollIndex/);
  });

  it("SlayChargeCard component file exists with the reroll button", () => {
    const src = read("client/src/components/SlayChargeCard.tsx");
    expect(src).toMatch(/data-testid="slay-charge-reroll"/);
    expect(src).toMatch(/give me another/i);
    expect(src).toMatch(/trpc\.today\.slayCharge\.useQuery/);
  });

  it("SlayChargeCard self-hides when the picker returns non-OK", () => {
    const src = read("client/src/components/SlayChargeCard.tsx");
    expect(src).toMatch(/pick\.ok\s*!==\s*true/);
    expect(src).toMatch(/return null/);
  });

  it("Today.tsx imports SlayChargeCard", () => {
    const src = read("client/src/pages/Today.tsx");
    expect(src).toMatch(
      /import\s+\{\s*SlayChargeCard\s*\}\s+from\s+["']@\/components\/SlayChargeCard["']/,
    );
  });

  it("Today.tsx mounts SlayChargeCard only inside morning-vibe blocks", () => {
    const src = read("client/src/pages/Today.tsx");
    // Find the SlayChargeCard usage line — must be guarded by morning_vibe / morning_warmup / Slay Charge title.
    const idx = src.indexOf("<SlayChargeCard");
    expect(idx).toBeGreaterThan(-1);
    // Look backwards ~400 chars for the guard.
    const before = src.slice(Math.max(0, idx - 400), idx);
    expect(before).toMatch(/morning_vibe/);
    expect(before).toMatch(/slay charge/i);
  });

  it("Analytics Recent Submissions still filters morning-vibe rows", () => {
    const src = read("client/src/pages/Analytics.tsx");
    expect(src).toMatch(/morning_vibe/);
    expect(src).toMatch(/morning_warmup/);
    expect(src).toMatch(/slay charge/i);
  });

  it("seeds in server/db.ts no longer contain 'Soft start' or 'Slow morning'", () => {
    const src = read("server/db.ts");
    // The seed templates we rewrote should no longer contain the legacy titles.
    // (They may still exist in legacy DB rows — those are filtered at render
    // time. This invariant just locks the rename in code.)
    const seedSlice = src.slice(0, src.indexOf("} else {") || src.length);
    expect(seedSlice).not.toMatch(/title:\s*"Soft start"/);
    expect(seedSlice).not.toMatch(/title:\s*"Slow morning"/);
  });

  it("server/db.ts seeds use the new 'Slay Charge ⚡' title + morning_vibe type", () => {
    const src = read("server/db.ts");
    expect(src).toMatch(/Slay Charge ⚡/);
    expect(src).toMatch(/type:\s*"morning_vibe"/);
  });
});
