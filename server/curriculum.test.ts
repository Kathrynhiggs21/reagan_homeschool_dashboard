import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("curriculum", () => {
  beforeAll(async () => {
    // migration 0033 already applied by applyMigration0033.test.ts, but in
    // case tests run in parallel/different order, apply it again idempotently.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const mysql = (await import("mysql2/promise")).default;
    const sqlPath = path.resolve(__dirname, "..", "drizzle", "0033_early_iron_fist.sql");
    const raw = fs.readFileSync(sqlPath, "utf8").replace(/CREATE TABLE `/g, "CREATE TABLE IF NOT EXISTS `");
    const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL!, multipleStatements: true });
    await conn.query(raw);
    await conn.end();
  });

  it("ensureCurriculumSeeded seeds only once", async () => {
    const first = await db.ensureCurriculumSeeded();
    expect(first.count).toBeGreaterThan(40);
    const second = await db.ensureCurriculumSeeded();
    expect(second.seeded).toBe(false);
    expect(second.count).toBe(first.count);
  }, 30_000);

  it("listCurriculumTopics returns topics in pacing order per subject", async () => {
    const math = await db.listCurriculumTopics("Math");
    expect((math as any[]).length).toBeGreaterThan(10);
    const codes = (math as any[]).map((r: any) => r.code);
    // EnVision pacing: Topic 1 precedes Topic 2
    expect(codes.indexOf("Math 1")).toBeLessThan(codes.indexOf("Math 2"));
    expect(codes.indexOf("Math 2")).toBeLessThan(codes.indexOf("Math 7"));
  });

  it("curriculumProgress reports a per-subject percentage", async () => {
    const rows = await db.curriculumProgress();
    const byName = Object.fromEntries(rows.map((r) => [r.subject, r]));
    expect(byName.Math).toBeTruthy();
    expect(byName.Math!.total).toBeGreaterThan(10);
  });

  it("autoCompleteFromHistory marks Q1 topics as done", async () => {
    // Reset Q1 rows first so the assertion is meaningful on repeat runs
    const mysql = (await import("mysql2/promise")).default;
    const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL! });
    await conn.query("UPDATE curriculumTopics SET status = 'notStarted', completed_at = NULL WHERE quarter = 'Q1'");
    await conn.end();
    const res = await db.autoCompleteFromHistory();
    expect(res.byQuarter).toBeGreaterThan(0);
    const math = await db.listCurriculumTopics("Math");
    const q1Done = (math as any[]).filter((r: any) => r.quarter === "Q1" && r.status === "done").length;
    expect(q1Done).toBeGreaterThan(0);
  }, 30_000);
});
