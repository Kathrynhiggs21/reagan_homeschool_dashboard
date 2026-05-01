/**
 * academics.list with schoolYear/term filters returns only matching rows.
 * Confirms the filter parameters added by the Academics timeline UI work end-to-end.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { academicRecords } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

const ownerOpenId = process.env.OWNER_OPEN_ID || "manus-ci";
const ctx = { user: { openId: ownerOpenId, role: "owner" as const, name: "ci" } };
const caller = appRouter.createCaller(ctx as any);

const tag = `VITEST-LISTFILTER-${process.pid}-${Date.now()}`;
const ids: number[] = [];

describe("academics.list filters", () => {
  beforeAll(async () => {
    const a = await caller.academics.create({
      source: "manual",
      kind: "grade",
      title: `${tag} A`,
      subjectSlug: "math",
      scoreText: "A",
      scorePercent: 95,
      schoolYear: "2025-26",
      term: "Q1",
    } as any);
    const b = await caller.academics.create({
      source: "manual",
      kind: "grade",
      title: `${tag} B`,
      subjectSlug: "math",
      scoreText: "B",
      scorePercent: 85,
      schoolYear: "2024-25",
      term: "Q4",
    } as any);
    ids.push((a as any).id, (b as any).id);
  });

  afterAll(async () => {
    if (ids.length) await getDb().delete(academicRecords).where(inArray(academicRecords.id, ids));
  });

  it("filters by schoolYear", async () => {
    const rows = (await caller.academics.list({ schoolYear: "2025-26" } as any)) as any[];
    const mine = rows.filter((r) => r.title?.startsWith(tag));
    expect(mine.length).toBe(1);
    expect(mine[0].schoolYear).toBe("2025-26");
  });

  it("filters by term", async () => {
    const rows = (await caller.academics.list({ term: "Q4" } as any)) as any[];
    const mine = rows.filter((r) => r.title?.startsWith(tag));
    expect(mine.length).toBe(1);
    expect(mine[0].term).toBe("Q4");
  });

  it("returns both with no filter", async () => {
    const rows = (await caller.academics.list({} as any)) as any[];
    const mine = rows.filter((r) => r.title?.startsWith(tag));
    expect(mine.length).toBe(2);
  });
});
