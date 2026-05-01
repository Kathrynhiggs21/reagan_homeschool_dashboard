import { describe, it, expect } from "vitest";
import mysql from "mysql2/promise";

/**
 * Idempotent application of drizzle/0041_orange_cargill.sql which extends
 * `academicRecords` with grade / schoolYear / term / teacher / courseName.
 * We do NOT replay the raw migration SQL because MySQL's `ADD COLUMN` is not
 * idempotent. Instead we inspect information_schema and only add columns that
 * don't already exist.
 */
describe("migration 0041 — academicRecords per-year columns", () => {
  it("adds grade, schoolYear, term, teacher, courseName columns", async () => {
    const conn = await mysql.createConnection({
      uri: process.env.DATABASE_URL!,
      multipleStatements: true,
    });
    try {
      const wanted: Array<{ name: string; type: string }> = [
        { name: "grade", type: "varchar(4)" },
        { name: "schoolYear", type: "varchar(9)" },
        { name: "term", type: "varchar(4)" },
        { name: "teacher", type: "varchar(80)" },
        { name: "courseName", type: "varchar(120)" },
      ];
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'academicRecords'`,
      );
      const have = new Set((rows as any[]).map(r => String(r.COLUMN_NAME)));
      for (const w of wanted) {
        if (!have.has(w.name)) {
          await conn.query(`ALTER TABLE \`academicRecords\` ADD \`${w.name}\` ${w.type}`);
        }
      }
      const [rows2] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'academicRecords'`,
      );
      const have2 = new Set((rows2 as any[]).map(r => String(r.COLUMN_NAME)));
      for (const w of wanted) {
        expect(have2.has(w.name)).toBe(true);
      }
    } finally {
      await conn.end();
    }
  }, 30_000);
});
