import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

/**
 * Migration 0038 — Adult Assignments Library + Bundles
 *
 * Idempotent application of the assignments_library and assignment_bundles
 * tables so the live DB reflects drizzle/0038_organic_masked_marvel.sql.
 */
async function safeExec(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e: any) {
    const msg = String(e?.message ?? e?.cause?.message ?? e ?? "");
    const code = e?.code ?? e?.cause?.code ?? "";
    // Idempotent guards: table already exists, column already exists.
    const ok =
      code === "ER_TABLE_EXISTS_ERROR" ||
      code === "ER_DUP_FIELDNAME" ||
      /Table .* already exists/i.test(msg) ||
      /Duplicate column name/i.test(msg);
    if (!ok) {
      console.error(`[migration 0038] ${label} failed:`, msg);
      throw e;
    }
  }
}

describe("migration 0038 — assignments library + bundles", () => {
  it("creates the two tables idempotently", async () => {
    const db = getDb();

    await safeExec("create assignment_bundles", () =>
      db.execute(sql`CREATE TABLE \`assignment_bundles\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`name\` varchar(300) NOT NULL,
        \`subject_slug\` varchar(32),
        \`topic\` varchar(200),
        \`date_for\` varchar(10),
        \`reminder_only\` boolean NOT NULL DEFAULT false,
        \`notes\` text,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`assignment_bundles_id\` PRIMARY KEY(\`id\`)
      )`),
    );

    await safeExec("create assignments_library", () =>
      db.execute(sql`CREATE TABLE \`assignments_library\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`title\` varchar(300) NOT NULL,
        \`subject_slug\` varchar(32),
        \`type\` varchar(32) NOT NULL,
        \`topic\` varchar(200),
        \`tags\` json,
        \`from_source\` varchar(80) NOT NULL DEFAULT 'manual',
        \`ih_classroom\` boolean NOT NULL DEFAULT false,
        \`date_received\` varchar(10),
        \`date_for\` varchar(10),
        \`status\` varchar(16) NOT NULL DEFAULT 'pending',
        \`recommended_use\` int NOT NULL DEFAULT 3,
        \`source_url\` varchar(1000),
        \`file_link\` varchar(1000),
        \`bundle_id\` int,
        \`bundle_step\` int,
        \`linked_item_ids\` json,
        \`notes\` text,
        \`reagan_clicked\` boolean NOT NULL DEFAULT false,
        \`completed_at\` timestamp,
        \`block_id\` int,
        \`auto_grade_score\` int,
        \`auto_grade_feedback\` text,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`assignments_library_id\` PRIMARY KEY(\`id\`)
      )`),
    );

    // Sanity check: tables can be queried.
    const a: any = await db.execute(sql`SELECT COUNT(*) AS n FROM assignments_library`);
    const aRows = Array.isArray(a) ? (a[0] ?? a) : (a as any).rows ?? [];
    expect(Number(aRows[0]?.n ?? 0)).toBeGreaterThanOrEqual(0);

    const b: any = await db.execute(sql`SELECT COUNT(*) AS n FROM assignment_bundles`);
    const bRows = Array.isArray(b) ? (b[0] ?? b) : (b as any).rows ?? [];
    expect(Number(bRows[0]?.n ?? 0)).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
