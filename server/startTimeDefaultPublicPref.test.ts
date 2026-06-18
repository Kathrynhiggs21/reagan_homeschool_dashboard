/**
 * 2026-06-18 — AgendaCalendarStrip flows untimed blocks from the standing
 * day-start default (summer.startTimeDefault). It reads that value through
 * `prefs.getPublic` so the kid/public view (which runs before the adult-lock
 * is satisfied) can resolve it too. This contract test locks two facts:
 *
 *   1. `summer.startTimeDefault` is on the prefs.getPublic allowlist.
 *   2. AgendaCalendarStrip queries it via prefs.getPublic (not the protected
 *      prefs.get), so unauthenticated/kid reads succeed.
 *
 * Source-pattern only — no DB, no render — so it stays fast and resilient.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS = readFileSync(join(__dirname, "routers.ts"), "utf8");
const STRIP = readFileSync(
  join(__dirname, "..", "client", "src", "components", "AgendaCalendarStrip.tsx"),
  "utf8",
);

describe("summer.startTimeDefault is publicly readable for the calendar strip", () => {
  it("is included in the prefs.getPublic ALLOW set", () => {
    const getPublicBlock = ROUTERS.match(/getPublic:\s*publicProcedure[\s\S]*?const ALLOW = new Set\(\[([\s\S]*?)\]\);/);
    expect(getPublicBlock, "prefs.getPublic ALLOW set must exist").toBeTruthy();
    expect(getPublicBlock![1]).toContain("summer.startTimeDefault");
  });

  it("AgendaCalendarStrip reads it via prefs.getPublic (not protected prefs.get)", () => {
    expect(STRIP).toMatch(/trpc\.prefs\.getPublic\.useQuery\(\s*\{\s*key:\s*["']summer\.startTimeDefault["']/);
    // Guard against regressing back to the protected query for this key.
    expect(STRIP).not.toMatch(/trpc\.prefs\.get\.useQuery\(\s*\{\s*key:\s*["']summer\.startTimeDefault["']/);
  });

  it("falls back to 10 (10 AM) when the pref is unset", () => {
    expect(STRIP).toMatch(/hourFromHHMM\([^)]*\)\s*\?\?\s*\n?\s*10/);
  });
});
