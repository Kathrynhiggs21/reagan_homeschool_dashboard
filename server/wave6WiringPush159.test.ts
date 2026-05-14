/**
 * Push 159 (2026-05-14) — vitest source-level contract that the three
 * Wave-6 helpers are wired into the today router as tRPC procedures.
 *
 * Source-level (string) so we can prove wiring without a live tRPC env.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS = readFileSync(
  join(__dirname, "routers.ts"),
  "utf8",
);

describe("Push 159 — Wave-6 wiring into today router", () => {
  it("wires today.parseReaganRequest as publicProcedure mutation", () => {
    expect(ROUTERS).toContain("parseReaganRequest: publicProcedure");
    expect(ROUTERS).toContain('"./_lib/reaganRequestParser"');
    expect(ROUTERS).toMatch(/parseReaganRequest\(input\.raw,\s*new Date\(\)\.toISOString\(\)\)/);
  });

  it("wires today.classifyOffCurriculum as familyAdminProcedure mutation with catalog input", () => {
    expect(ROUTERS).toContain("classifyOffCurriculum: familyAdminProcedure");
    expect(ROUTERS).toContain('"./_lib/offCurriculumClassifier"');
    expect(ROUTERS).toMatch(/classifyOffCurriculum\(input\.chunk,\s*input\.catalog\)/);
  });

  it("wires today.applyAdultQuickEntry as familyAdminProcedure mutation", () => {
    expect(ROUTERS).toContain("applyAdultQuickEntry: familyAdminProcedure");
    expect(ROUTERS).toContain('"./_lib/adultQuickEntryPayload"');
    expect(ROUTERS).toContain("buildAdultQuickEntryPayload(");
  });

  it("schoolDayISO input is YYYY-MM-DD enforced via regex", () => {
    expect(ROUTERS).toMatch(/schoolDayISO:\s*z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\)/);
  });

  it("Reagan request input is capped at 2000 chars", () => {
    expect(ROUTERS).toMatch(/raw:\s*z\.string\(\)\.min\(1\)\.max\(2000\)/);
  });

  it("off-curriculum chunk input is capped at 4000 chars", () => {
    expect(ROUTERS).toMatch(/chunk:\s*z\.string\(\)\.min\(1\)\.max\(4000\)/);
  });

  it("catalog rows match CurriculumTopicCandidate shape (id/label/subject/keywords?)", () => {
    expect(ROUTERS).toMatch(/id:\s*z\.string\(\)/);
    expect(ROUTERS).toMatch(/label:\s*z\.string\(\)/);
    expect(ROUTERS).toMatch(/subject:\s*z\.string\(\)/);
    expect(ROUTERS).toMatch(/keywords:\s*z\.array\(z\.string\(\)\)\.optional\(\)/);
  });

  it("catalog is bounded (max 500) so a malicious request can't OOM", () => {
    expect(ROUTERS).toMatch(/catalog:[\s\S]*?\.max\(500\)/);
  });

  it("quick-entry lines are bounded (max 20) to keep one tap-form sane", () => {
    expect(ROUTERS).toMatch(/lines:[\s\S]*?\.max\(20\)/);
  });
});
