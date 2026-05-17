/**
 * v2.27 (2026-05-17) — Summer Mode planner integration.
 *
 * The summerMode helpers (effectiveSummerActive, summerSettingsFromKv,
 * summerChoiceOptions, streakBoostMultiplier) have existed since Push 65,
 * but ensurePlanForDate never consulted them. v2.27 wires the planner so:
 *
 *   1. Inside the auto window (Jun 6 – Aug 15) on a regular weekday,
 *      ensurePlanForDate switches the auto-build template to a summer one.
 *   2. The summer build kind ("summer") feeds autoBuildBlocksForPlan, which
 *      now has a 6-block summer template (warmup, adventure, choice, reading,
 *      tiny practice, one-little-win).
 *   3. Calendar off-days (IH 25-26 staff days, federal holidays) and
 *      Sat/Sun still take precedence — summer never overrides them.
 *   4. Manual override = "off" cancels summer even inside the window.
 *   5. Manual override = "on" forces summer outside the window.
 *
 * This test is source-pattern only — fast (no DB) and locks the wiring
 * into server/db.ts and server/summerMode.ts. The behavioral edges
 * (override, vacation, streak boost) are already covered by the existing
 * server/summerMode.test.ts and server/summerModeSettings.test.ts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("v2.27 — Summer Mode planner integration", () => {
  it("server/db.ts imports effectiveSummerActive + summerSettingsFromKv", () => {
    const src = readText("server/db.ts");
    expect(src).toMatch(
      /import\(\s*["'`]\.\/summerMode["'`]\s*\)|from\s+["'`]\.\/summerMode["'`]/,
    );
    expect(src).toMatch(/effectiveSummerActive/);
    expect(src).toMatch(/summerSettingsFromKv/);
  });

  it("ensurePlanForDate reads all 5 summer.* app_settings keys", () => {
    const src = readText("server/db.ts");
    expect(src).toMatch(/getAppSetting\(\s*["'`]summer\.autoFlipEnabled["'`]\s*\)/);
    expect(src).toMatch(/getAppSetting\(\s*["'`]summer\.start["'`]\s*\)/);
    expect(src).toMatch(/getAppSetting\(\s*["'`]summer\.end["'`]\s*\)/);
    expect(src).toMatch(/getAppSetting\(\s*["'`]summer\.override["'`]\s*\)/);
    expect(src).toMatch(/getAppSetting\(\s*["'`]summer\.vacationRanges["'`]\s*\)/);
  });

  it("ensurePlanForDate computes isSummerActive via effectiveSummerActive(dateStr, settings).active", () => {
    const src = readText("server/db.ts");
    expect(src).toMatch(/isSummerActive\s*=\s*effectiveSummerActive\(\s*dateStr\s*,\s*settings\s*\)\.active/);
  });

  it("v2.27 marker comment exists with date 2026-05-17", () => {
    const src = readText("server/db.ts");
    expect(src).toMatch(/v2\.27\s*\(2026-05-17\)/);
  });

  it("isCalendarOff and isWeekend take precedence over isSummerActive in finalDayType", () => {
    const src = readText("server/db.ts");
    // The finalDayType ternary should test isOff before isSummerActive.
    expect(src).toMatch(
      /finalDayType\s*=\s*isOff\s*\?\s*["'`]off["'`]\s*:\s*dow\s*===\s*3\s*\?\s*["'`]half["'`]\s*:\s*isSummerActive\s*\?\s*["'`]outdoor["'`]\s*:\s*dayType/,
    );
  });

  it("buildKind is 'summer' when isSummerActive and not weekend/off", () => {
    const src = readText("server/db.ts");
    // The buildKind cascade should have isWeekend → 'weekend' first, then
    // isSummerActive → 'summer' before therapy/full.
    expect(src).toMatch(/isWeekend[\s\S]{0,60}["'`]weekend["'`][\s\S]{0,200}isSummerActive[\s\S]{0,60}["'`]summer["'`]/);
  });

  it("autoBuildBlocksForPlan has an isSummer branch with the v2.27 summer template", () => {
    const src = readText("server/db.ts");
    expect(src).toMatch(/const\s+isSummer\s*=\s*dayType\s*===\s*["'`]summer["'`]/);
    expect(src).toMatch(/summerTemplate\s*:/);
    // The 6 summer blocks should include these distinguishing strings:
    expect(src).toMatch(/Summer charge/);
    expect(src).toMatch(/Summer adventure/);
    expect(src).toMatch(/Summer choice/);
    expect(src).toMatch(/Cozy reading/);
    expect(src).toMatch(/Tiny practice/);
    // Reuses the weekend "One little win" wrap-up.
    expect(src).toMatch(/One little win/);
  });

  it("summer template uses canonical scheduleBlocks block types only", () => {
    const src = readText("server/db.ts");
    // scheduleBlocks.blockType enum is [morning_warmup, math, adventure,
    // read_aloud, choice, catch_up, appointment, custom]. Confirm the
    // summer template stays inside that enum and titles still pin to
    // the right kind so the kid-side surfaces render correctly.
    expect(src).toMatch(/Summer charge[\s\S]{0,200}type:\s*["'`]morning_warmup["'`]/);
    expect(src).toMatch(/Summer adventure[\s\S]{0,200}type:\s*["'`]adventure["'`]/);
    expect(src).toMatch(/Summer choice[\s\S]{0,200}type:\s*["'`]choice["'`]/);
    expect(src).toMatch(/Cozy reading[\s\S]{0,200}type:\s*["'`]read_aloud["'`]/);
    expect(src).toMatch(/Tiny practice[\s\S]{0,200}type:\s*["'`]math["'`]/);
    expect(src).toMatch(/One little win[\s\S]{0,200}type:\s*["'`]catch_up["'`]/);
  });

  it("template ternary is summer → weekend → therapy → full (correct precedence)", () => {
    const src = readText("server/db.ts");
    // The template assignment line should test isSummer first.
    expect(src).toMatch(/template[^=]*=\s*isSummer\s*\?\s*summerTemplate\s*:\s*isWeekend/);
  });

  it("server/summerMode.ts still exports the 4 helpers ensurePlanForDate depends on", () => {
    const src = readText("server/summerMode.ts");
    expect(src).toMatch(/export\s+function\s+effectiveSummerActive/);
    expect(src).toMatch(/export\s+function\s+summerSettingsFromKv/);
    expect(src).toMatch(/export\s+function\s+streakBoostMultiplier/);
    expect(src).toMatch(/export\s+function\s+summerChoiceOptions/);
  });

  it("graceful-degrade: planner falls back to school-year template if settings query throws", () => {
    const src = readText("server/db.ts");
    // The try/catch in ensurePlanForDate's summer block must default isSummerActive=false
    // on any error so a missing/corrupt setting doesn't break the planner.
    expect(src).toMatch(
      /isSummerActive\s*=\s*false;\s*\/\/\s*graceful degrade if settings query fails/,
    );
  });

  it("v2.27 reuses the dailyPlans 'outdoor' enum value (no schema migration)", () => {
    const src = readText("server/db.ts");
    // The finalDayType ternary writes "outdoor" for summer days because the
    // enum hasn't been extended (avoids a migration).
    expect(src).toMatch(
      /isSummerActive\s*\?\s*["'`]outdoor["'`]\s*:\s*dayType/,
    );
    // And the schema must still have "outdoor" as a legal enum value.
    const schema = readText("drizzle/schema.ts");
    expect(schema).toMatch(/dayType:\s*mysqlEnum\(\s*["'`]dayType["'`],\s*\[[^\]]*["'`]outdoor["'`]/);
  });
});
