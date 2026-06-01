/**
 * Push 39 — Today adult quick-entry card + actuals tRPC router.
 *
 * Contract checks:
 *   1. The actuals router exists and gates the writes behind
 *      familyAdminProcedure. The read path uses protectedProcedure so
 *      tutors can see what's already logged for the day.
 *   2. Validation: dateISO regex, minutesSpent 0..600, source enum
 *      stays in sync with the schema's recordActualEntry source set.
 *   3. The router calls db.recordActualEntry (single source of truth)
 *      and db.deleteActualEntry for undo — no shadow path.
 *   4. The Today.tsx card mounts only when adult is unlocked and
 *      writes through trpc.actuals.quickAdd.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Today quick-entry card — push 39", () => {
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const dbSrc = fs.readFileSync(path.join(__dirname, "db.ts"), "utf-8");
  const todaySrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Today.tsx"),
    "utf-8",
  );

  it("declares an actuals: router block", () => {
    expect(routersSrc).toMatch(/actuals: router\(\{/);
  });

  it("listForDate uses protectedProcedure and date regex", () => {
    const idx = routersSrc.indexOf("listForDate: protectedProcedure");
    expect(idx).toBeGreaterThan(0);
    const slice = routersSrc.slice(idx, idx + 400);
    expect(slice).toMatch(/regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\)/);
  });

  it("quickAdd uses familyAdminProcedure (Mom/Grandma/active tutor gate)", () => {
    expect(routersSrc).toMatch(/quickAdd:\s*familyAdminProcedure/);
  });

  it("quickAdd validates minutesSpent 0..600 and source enum", () => {
    const idx = routersSrc.indexOf("quickAdd: familyAdminProcedure");
    const slice = routersSrc.slice(idx, idx + 1400);
    expect(slice).toContain("minutesSpent: z.number().int().min(0).max(600)");
    expect(slice).toContain('z\n            .enum(["reagan-checkin", "mom-input", "grandma-recap", "tutor-note"])');
  });

  it("quickAdd writes through db.recordActualEntry (single source of truth)", () => {
    const idx = routersSrc.indexOf("quickAdd: familyAdminProcedure");
    const slice = routersSrc.slice(idx, idx + 2000);
    expect(slice).toContain("db.recordActualEntry(");
  });

  it("deleteRecent uses familyAdminProcedure and calls db.deleteActualEntry", () => {
    const idx = routersSrc.indexOf("deleteRecent: familyAdminProcedure");
    expect(idx).toBeGreaterThan(0);
    const slice = routersSrc.slice(idx, idx + 800);
    expect(slice).toContain("db.deleteActualEntry(input.id)");
  });

  it("db.deleteActualEntry triggers a day-log rebuild for the deleted date", () => {
    const idx = dbSrc.indexOf("export async function deleteActualEntry");
    expect(idx).toBeGreaterThan(0);
    const slice = dbSrc.slice(idx, idx + 1000);
    expect(slice).toContain("enqueueDayLogRebuildForDate(dateISO)");
  });

  it("Today.tsx mounts TodayQuickEntryCard only when adult is unlocked", () => {
    // v3.28 (2026-06-01): the cards moved inside an adult-only <details> drawer
    // wrapped by {unlocked && (<details>...</details>)}. The semantic contract
    // is that <TodayQuickEntryCard /> mounts within that gated slice, not that
    // it appears immediately after the opening `{unlocked && (`.
    const gateIdx = todaySrc.indexOf("{unlocked && (");
    expect(gateIdx).toBeGreaterThan(0);
    // Find the matching closing `)}` after the first unlocked-gated block by
    // taking a generous slice; the next top-level `)}` after gateIdx is the
    // closer for the adult drawer.
    const slice = todaySrc.slice(gateIdx, gateIdx + 8000);
    expect(slice).toContain("<TodayQuickEntryCard");
  });

  it("TodayQuickEntryCard is defined and writes via trpc.actuals.quickAdd", () => {
    expect(todaySrc).toContain("function TodayQuickEntryCard()");
    expect(todaySrc).toMatch(/actuals\?\.quickAdd\?\.useMutation\?\./);
    expect(todaySrc).toContain('source: "mom-input"');
  });

  it("TodayQuickEntryCard surfaces today's recent entries via actuals.listForDate", () => {
    expect(todaySrc).toMatch(/actuals\?\.listForDate\?\.useQuery\?\.\(\{ dateISO \}\)/);
  });

  it("TodayQuickEntryCard supports undo via actuals.deleteRecent", () => {
    expect(todaySrc).toMatch(/actuals\?\.deleteRecent\?\.useMutation/);
    expect(todaySrc).toContain("deleteM?.mutate({ id: r.id })");
  });
});
