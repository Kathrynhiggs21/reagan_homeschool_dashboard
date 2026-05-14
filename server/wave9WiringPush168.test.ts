import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Push 168 — wave-9 helpers wired as tRPC procedures", () => {
  const src = readFileSync(join(__dirname, "routers.ts"), "utf8");

  it("declares today.tutorHandoffSummary as familyAdminProcedure", () => {
    expect(src).toMatch(/tutorHandoffSummary:\s*familyAdminProcedure/);
  });

  it("declares today.subjectTimeBalanceAlert as familyAdminProcedure", () => {
    expect(src).toMatch(/subjectTimeBalanceAlert:\s*familyAdminProcedure/);
  });

  it("dynamically imports both helper modules", () => {
    expect(src).toMatch(/_lib\/tutorHandoffSummary/);
    expect(src).toMatch(/_lib\/subjectTimeBalanceAlert/);
  });

  it("subjectTimeBalanceAlert input bounds elapsed days at 0..5", () => {
    expect(src).toMatch(/schoolDaysElapsedThisWeek:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(5\)/);
  });

  it("tutorHandoffSummary input requires YYYY-MM-DD forISO", () => {
    const block = src.split("tutorHandoffSummary: familyAdminProcedure")[1].split(".query")[0];
    expect(block).toMatch(/forISO:\s*z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  });
});
