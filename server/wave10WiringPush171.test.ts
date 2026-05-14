import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Push 171 (2026-05-15 Wave-11) — source-level wiring contract for
 * today.kidStreakSummary + today.suggestBreak tRPC procedures.
 */
describe("Push 171 — kidStreakSummary + suggestBreak wiring in routers.ts", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "routers.ts"),
    "utf-8",
  );

  it("declares today.kidStreakSummary as publicProcedure", () => {
    expect(src).toMatch(/kidStreakSummary:\s*publicProcedure/);
  });

  it("declares today.suggestBreak as familyAdminProcedure", () => {
    expect(src).toMatch(/suggestBreak:\s*familyAdminProcedure/);
  });

  it("imports computeKidStreaks from kidStreakSummary helper", () => {
    expect(src).toMatch(/computeKidStreaks.*kidStreakSummary/s);
  });

  it("imports pickReaganBreak from breakPlanner helper", () => {
    expect(src).toMatch(/pickReaganBreak.*breakPlanner/s);
  });

  it("validates suggestBreak mood enum (great/okay/tired/frustrated)", () => {
    const block = src.match(/suggestBreak:[\s\S]{0,1500}/)?.[0] ?? "";
    expect(block).toMatch(/mood:\s*z\.enum\(\["great",\s*"okay",\s*"tired",\s*"frustrated"\]\)/);
  });

  it("validates kidStreakSummary lookbackDays bounds (1..60)", () => {
    const block = src.match(/kidStreakSummary:[\s\S]{0,800}/)?.[0] ?? "";
    expect(block).toMatch(/lookbackDays.*min\(1\).*max\(60\)/s);
  });

  it("both procedures sit inside the today router (after subjectTimeBalanceAlert, before tomorrowChoice)", () => {
    const a = src.indexOf("subjectTimeBalanceAlert: familyAdminProcedure");
    const b = src.indexOf("kidStreakSummary: publicProcedure");
    const c = src.indexOf("suggestBreak: familyAdminProcedure");
    const d = src.indexOf("tomorrowChoice: publicProcedure");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(d).toBeGreaterThan(c);
  });
});
