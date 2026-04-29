import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { iepGoals, iepAccommodations, skillLadder, books, adventures } from "../drizzle/schema";

const db = getDb();

describe("Reagan handoff cleanup punchlist invariants", () => {
  it("no duplicate IEP goals (case/whitespace-insensitive)", async () => {
    const rows = (await db.select({ goalText: iepGoals.goalText }).from(iepGoals)) as Array<{
      goalText: string | null;
    }>;
    const norms = rows
      .map((r) => (r.goalText || "").toLowerCase().replace(/\s+/g, " ").trim())
      .filter(Boolean);
    expect(new Set(norms).size).toBe(norms.length);
  });

  it("no duplicate IEP accommodations", async () => {
    const rows = (await db.select({ t: iepAccommodations.accommodationText }).from(iepAccommodations)) as Array<{
      t: string | null;
    }>;
    const norms = rows
      .map((r) => (r.t || "").toLowerCase().replace(/\s+/g, " ").trim())
      .filter(Boolean);
    expect(new Set(norms).size).toBe(norms.length);
  });

  it("no skillLadder rows whose title/code/strand contain TEST", async () => {
    const all = await db
      .select({ id: skillLadder.id, title: skillLadder.title, code: skillLadder.skillCode, strand: skillLadder.strand })
      .from(skillLadder);
    const offenders = all.filter((s) => {
      // Ignore in-flight vitest fixtures (feedback.test.ts inserts → deletes a test skill row)
      if (/^__vitest/.test(s.title) || /^__vitest/.test(s.code) || /^__vitest/.test(s.strand)) return false;
      return /test/i.test(s.title) || /TEST/.test(s.code) || /TEST/.test(s.strand);
    });
    expect(offenders, `Offending skill rows: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('no "Test Book" rows on the bookshelf', async () => {
    const all = await db.select({ title: books.title, author: books.author }).from(books);
    const offenders = all.filter((b) =>
      // Skip in-flight vitest fixtures (newFeatures.test.ts books.create→update→delete races with this guard)
      !/^__vitest_/.test(b.title) && !/^__vitest_/.test(b.author || "") &&
      (/^Test Book/i.test(b.title) || (b.author || "") === "Tester")
    );
    expect(offenders).toEqual([]);
  });

  it("no Brutus adventures (Brutus the bearded dragon does not exist)", async () => {
    const all = await db.select({ title: adventures.title, description: adventures.description }).from(adventures);
    const offenders = all.filter((a) => /brutus/i.test(a.title) || /brutus/i.test(a.description || ""));
    expect(offenders).toEqual([]);
  });


});
