import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { proudMoments, journalEntries } from "../drizzle/schema";
import { sql, like } from "drizzle-orm";

/**
 * bumpFromJournal: scanning a journal body should create matching ProudMoments
 * with source="auto". We tag titles uniquely so cleanup is deterministic.
 */
describe("bumpFromJournal soft-skill auto-bump", () => {
  const DATE = "2099-04-15"; // far-future date so we don't touch real entries
  const YEST = "2099-04-14";
  const PRIOR = "2099-04-13";

  afterAll(async () => {
    const drizzle = (db as any).getDb?.() ?? null;
    // Clean up moments + journal rows we created.
    await drizzle.execute(sql`DELETE FROM proudMoments WHERE source = 'auto' AND title LIKE 'Caught a moment of % \u2014 2099-04-15%'`);
    await drizzle.execute(sql`DELETE FROM proudMoments WHERE source = 'auto' AND title = '3-day streak of soft-skill wins \ud83c\udf08'`);
    await drizzle.execute(sql`DELETE FROM journalEntries WHERE date IN ('2099-04-15','2099-04-14','2099-04-13')`);
  });

  it("creates a kindness moment when body says 'helped' and an effort moment when body says 'tried'", async () => {
    const r = await db.bumpFromJournal({ date: DATE, body: "Today I helped my sister and I tried hard at math." });
    const cats = r.created.map((c) => c.category).sort();
    expect(cats).toContain("kindness");
    expect(cats).toContain("effort");
  });

  it("does not create anything when body is unrelated", async () => {
    const r = await db.bumpFromJournal({ date: DATE, body: "Just a plain log of weather and lunch." });
    expect(r.created.length).toBe(0);
    expect(r.streakBonus).toBeNull();
  });

  it("awards a 3-day streak bonus when prior two days also had soft-skill mentions", async () => {
    const drizzle = (db as any).getDb?.() ?? null;
    await drizzle.insert(journalEntries).values([
      { date: YEST as any, body: "I tried again on the puzzle.", title: null, mood: null } as any,
      { date: PRIOR as any, body: "I was kind to my brother today.", title: null, mood: null } as any,
    ]);
    const r = await db.bumpFromJournal({ date: DATE, body: "I drew a really cool monster and tried hard." });
    expect(r.streakBonus).toBeTruthy();
    expect(r.streakBonus!.category).toBe("growth");
  });
});
