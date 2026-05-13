/**
 * Push 37 — Tomorrow's draft preview strip.
 *
 * Validates:
 *   1. db.getTomorrowDraftPreview is exported with the expected shape.
 *   2. The helper computes the next school day by skipping Sat (6) + Sun (0).
 *   3. trpc.curriculum.tomorrowPreview is registered as a protectedProcedure
 *      and calls into db.getTomorrowDraftPreview.
 *   4. Curriculum.tsx renders a `tomorrow-draft-strip` card that handles
 *      all three states (planExists+blocks, planExists+zero, no plan).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Tomorrow's draft preview — push 37", () => {
  const dbSrc = fs.readFileSync(path.join(__dirname, "db.ts"), "utf-8");
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const curriculumSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Curriculum.tsx"),
    "utf-8",
  );

  it("db.getTomorrowDraftPreview is exported", () => {
    expect(dbSrc).toContain("export async function getTomorrowDraftPreview(");
  });

  it("helper skips Saturday + Sunday (next school day algorithm)", () => {
    expect(dbSrc).toMatch(
      /while \(target\.getDay\(\) === 0 \|\| target\.getDay\(\) === 6\)/,
    );
  });

  it("helper returns the documented shape (dateISO, dayLabel, planExists, blockCount, subjects, firstBlockTitle, lastGeneratedAt)", () => {
    const idx = dbSrc.indexOf("export async function getTomorrowDraftPreview(");
    const end = dbSrc.indexOf("\n}\n", idx);
    const body = dbSrc.slice(idx, end > 0 ? end : idx + 4000);
    expect(body).toContain("dateISO:");
    expect(body).toContain("dayLabel:");
    expect(body).toContain("planExists:");
    expect(body).toContain("blockCount:");
    expect(body).toContain("subjects:");
    expect(body).toContain("firstBlockTitle:");
    expect(body).toContain("lastGeneratedAt:");
  });

  it("helper short-circuits when no plan exists (planExists=false, blockCount=0)", () => {
    const idx = dbSrc.indexOf("export async function getTomorrowDraftPreview(");
    const body = dbSrc.slice(idx, idx + 4000);
    expect(body).toMatch(/if \(!plan\) \{/);
    expect(body).toMatch(/planExists: false/);
  });

  it("trpc curriculum.tomorrowPreview is registered as a protectedProcedure", () => {
    expect(routersSrc).toContain(
      "tomorrowPreview: protectedProcedure.query(() => db.getTomorrowDraftPreview())",
    );
  });

  it("Curriculum.tsx renders the strip with a stable data-testid", () => {
    expect(curriculumSrc).toContain('data-testid="tomorrow-draft-strip"');
  });

  it("Curriculum.tsx wires the strip to trpc.curriculum.tomorrowPreview.useQuery", () => {
    expect(curriculumSrc).toContain("curriculum?.tomorrowPreview?.useQuery");
  });

  it("Curriculum.tsx covers the three render states (committed, empty-plan, no-plan)", () => {
    // committed state
    expect(curriculumSrc).toContain("committed by the nightly draft");
    // empty-plan state
    expect(curriculumSrc).toContain(
      "Plan row exists but no blocks were committed by the nightly draft",
    );
    // no-plan state
    expect(curriculumSrc).toContain("the nightly draft hasn't run for this date");
  });

  it("Curriculum.tsx strip has 'Open in Agenda Editor' link to /agenda-editor", () => {
    expect(curriculumSrc).toMatch(/href="\/agenda-editor"/);
    expect(curriculumSrc).toContain("Open in Agenda Editor");
  });
});
