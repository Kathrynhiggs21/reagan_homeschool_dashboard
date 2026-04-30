import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

/**
 * Applies drizzle/0033_early_iron_fist.sql (curriculumTopics table) to the
 * project database exactly once. Uses CREATE TABLE IF NOT EXISTS so it is
 * idempotent and safe to re-run on every vitest pass.
 */
describe("migration 0033 — curriculumTopics", () => {
  it("creates the curriculumTopics table", async () => {
    const sqlPath = path.resolve(__dirname, "..", "drizzle", "0033_early_iron_fist.sql");
    const raw = fs.readFileSync(sqlPath, "utf8")
      .replace(/CREATE TABLE `/g, "CREATE TABLE IF NOT EXISTS `");

    const conn = await mysql.createConnection({
      uri: process.env.DATABASE_URL!,
      multipleStatements: true,
    });
    try {
      await conn.query(raw);
      const [rows] = await conn.query("SHOW TABLES LIKE 'curriculumTopics'");
      expect((rows as any[]).length).toBe(1);
    } finally {
      await conn.end();
    }
  }, 30_000);
});
