/**
 * v2.19 (2026-05-17) — BlockPrintablesPanel + per-block printables wiring.
 *
 * Source-pattern (string-grep) tests on:
 *   - drizzle/schema.ts (new nullable `block_id` column on dailyPrintables)
 *   - server/db.ts (4 new helpers)
 *   - server/routers.ts (4 new tRPC procs, with correct gates)
 *   - client/src/components/BlockPrintablesPanel.tsx (UI shape)
 *   - client/src/pages/AgendaEditor.tsx (mount + date forwarding)
 *
 * Locks:
 *   1. Schema column `block_id` exists, nullable, varchar(64).
 *   2. db helpers exported: listDailyPrintablesForBlock,
 *      attachPrintableToBlock, detachPrintableFromBlock, deletePrintable.
 *   3. printables router has forBlock/attachToBlock/detachFromBlock/remove.
 *   4. Reads (forBlock) are publicProcedure (matches the rest of the
 *      printables router); writes are familyAdminProcedure.
 *   5. Panel exists, short-circuits on missing date or blockId, uses
 *      the four trpc procedures, invalidates the forBlock query on
 *      every successful mutation, and surfaces explicit error UI.
 *   6. AgendaEditor imports the panel, forwards `date` to ManualBlockRow,
 *      and mounts the panel with `date` + `String(block.id)`.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "drizzle/schema.ts");
const DB_PATH = path.join(ROOT, "server/db.ts");
const ROUTERS_PATH = path.join(ROOT, "server/routers.ts");
const PANEL_PATH = path.join(ROOT, "client/src/components/BlockPrintablesPanel.tsx");
const AGENDA_EDITOR_PATH = path.join(ROOT, "client/src/pages/AgendaEditor.tsx");

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("v2.19 — schema", () => {
  it("dailyPrintables.block_id column declared (nullable varchar(64))", () => {
    const src = read(SCHEMA_PATH);
    // Match the column declaration anywhere in the dailyPrintables
    // table block; the helper is just a string check, not a parser.
    expect(src).toMatch(/blockId:\s*varchar\(\s*"block_id"\s*,\s*\{\s*length:\s*64\s*\}\s*\)/);
    // No `.notNull()` chained on this declaration — it must stay nullable
    // for backward compatibility with existing date-only printables.
    expect(src).not.toMatch(/blockId:\s*varchar\([^)]*\)\.notNull/);
  });
});

describe("v2.19 — db helpers", () => {
  const src = read(DB_PATH);
  it("exports listDailyPrintablesForBlock", () => {
    expect(src).toMatch(/export\s+async\s+function\s+listDailyPrintablesForBlock\s*\(/);
  });
  it("exports attachPrintableToBlock", () => {
    expect(src).toMatch(/export\s+async\s+function\s+attachPrintableToBlock\s*\(/);
  });
  it("exports detachPrintableFromBlock", () => {
    expect(src).toMatch(/export\s+async\s+function\s+detachPrintableFromBlock\s*\(/);
  });
  it("exports deletePrintable", () => {
    expect(src).toMatch(/export\s+async\s+function\s+deletePrintable\s*\(/);
  });
});

describe("v2.19 — tRPC procedures", () => {
  const src = read(ROUTERS_PATH);
  it("forBlock is publicProcedure", () => {
    // Read gate matches the rest of the printables router (today is
    // protectedProcedure but listSources/listFavorites are public; we
    // chose public here for symmetry with the other read procs).
    expect(src).toMatch(/forBlock:\s*publicProcedure/);
  });
  it("attachToBlock is familyAdminProcedure", () => {
    expect(src).toMatch(/attachToBlock:\s*familyAdminProcedure/);
  });
  it("detachFromBlock is familyAdminProcedure", () => {
    expect(src).toMatch(/detachFromBlock:\s*familyAdminProcedure/);
  });
  it("remove is familyAdminProcedure", () => {
    expect(src).toMatch(/\bremove:\s*familyAdminProcedure/);
  });
  it("attachToBlock delegates to db.attachPrintableToBlock (no inline SQL)", () => {
    expect(src).toMatch(/db\.attachPrintableToBlock/);
  });
  it("forBlock validates date as YYYY-MM-DD", () => {
    expect(src).toMatch(/forBlock[\s\S]{0,400}?\\d\{4\}-\\d\{2\}-\\d\{2\}/);
  });
});

describe("v2.19 — BlockPrintablesPanel", () => {
  const src = read(PANEL_PATH);
  it("file exists on disk", () => {
    expect(fs.existsSync(PANEL_PATH)).toBe(true);
  });
  it("short-circuits when date or blockId is missing", () => {
    expect(src).toMatch(/if\s*\(\s*!date\s*\|\|\s*!blockId\s*\)\s*return\s+null/);
  });
  it("reads via trpc.printables.forBlock.useQuery", () => {
    expect(src).toMatch(/trpc\.printables\.forBlock\.useQuery/);
  });
  it("calls all three mutation procedures", () => {
    expect(src).toMatch(/trpc\.printables\.attachToBlock\.useMutation/);
    expect(src).toMatch(/trpc\.printables\.detachFromBlock\.useMutation/);
    expect(src).toMatch(/trpc\.printables\.remove\.useMutation/);
  });
  it("invalidates forBlock cache on success", () => {
    expect(src).toMatch(/utils\.printables\.forBlock\.invalidate/);
  });
  it("surfaces explicit error UI with role=alert", () => {
    expect(src).toMatch(/role=\{?"alert"\}?/);
    expect(src).toMatch(/Couldn't load printables/);
  });
  it("exposes test ids the QA harness expects", () => {
    expect(src).toMatch(/data-testid="printable-title-input"/);
    expect(src).toMatch(/data-testid="printable-add"/);
    expect(src).toMatch(/data-testid="printable-bucket-select"/);
  });
});

describe("v2.19 — AgendaEditor mount", () => {
  const src = read(AGENDA_EDITOR_PATH);
  it("imports BlockPrintablesPanel", () => {
    expect(src).toMatch(
      /import\s*\{\s*BlockPrintablesPanel\s*\}\s*from\s+["']@\/components\/BlockPrintablesPanel["']/,
    );
  });
  it("forwards date prop into ManualBlockRow", () => {
    // ManualBlockRow must receive a `date={date}` prop now.
    expect(src).toMatch(/<ManualBlockRow[\s\S]{0,300}?date=\{date\}/);
  });
  it("ManualBlockRow signature accepts date: string", () => {
    expect(src).toMatch(/function\s+ManualBlockRow\([\s\S]{0,300}?date,/);
    expect(src).toMatch(/date:\s*string/);
  });
  it("mounts the panel with date + String(block.id)", () => {
    expect(src).toMatch(/<BlockPrintablesPanel\s+date=\{date\}\s+blockId=\{String\(block\.id\)\}/);
  });
});
