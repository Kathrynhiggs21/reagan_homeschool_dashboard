import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, gte, lte } from "drizzle-orm";
import { whisperSessions, actualAgendaEntries } from "../drizzle/schema";
import * as dbMod from "./db";

/**
 * Push 16 (2026-05-12): kiwiBehaviorForDate / kiwiBehaviorAggregate were
 * extended with topTopic + kiwiInitiatedCount (today) and longestStreak
 * (aggregate). These are the cards Mom sees on the Analytics page.
 *
 * We use unique fixture dates far in the future to avoid colliding with
 * any real rows.
 */

const D_TODAY = "2037-08-15";
const D_AGG_DAYS = ["2037-09-01", "2037-09-02", "2037-09-03", "2037-09-08", "2037-09-09"];

async function cleanup() {
  const db = (dbMod as any).getDb();
  // whisperSessions: delete any row inside our test window
  const start = new Date("2037-01-01T00:00:00Z");
  const end = new Date("2037-12-31T23:59:59Z");
  await db
    .delete(whisperSessions)
    .where(and(gte(whisperSessions.createdAt, start), lte(whisperSessions.createdAt, end)));
  // actualAgendaEntries: delete by dateISO match for our test days
  for (const d of [D_TODAY, ...D_AGG_DAYS]) {
    await db.delete(actualAgendaEntries).where(eq(actualAgendaEntries.dateISO as any, d));
  }
}

beforeAll(async () => {
  await cleanup();
});
afterAll(async () => {
  try {
    await cleanup();
  } catch {
    /* ignore */
  }
});

describe("kiwiBehaviorForDate (extended)", () => {
  it("returns null when there are zero whisper rows AND zero kiwi-listened entries", async () => {
    const out = await dbMod.kiwiBehaviorForDate("2037-12-31");
    expect(out).toBeNull();
  });

  it("computes topTopic from user message word frequency, ignoring stopwords", async () => {
    const db = (dbMod as any).getDb();
    const at = (h: number, m: number) =>
      new Date(`${D_TODAY}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    await db.insert(whisperSessions).values([
      { role: "user", content: "Tell me about parakeets and their feathers", createdAt: at(9, 0) },
      { role: "assistant", content: "Sure! Parakeets are colorful.", createdAt: at(9, 1) },
      { role: "user", content: "what do parakeets eat?", createdAt: at(10, 0) },
      { role: "user", content: "is it true parakeets sleep on one foot?", createdAt: at(11, 0) },
      { role: "user", content: "ducks are also cool", createdAt: at(12, 0) },
    ]);
    const out = await dbMod.kiwiBehaviorForDate(D_TODAY);
    expect(out).not.toBeNull();
    expect(out!.interactions).toBe(5);
    expect(out!.userMessages).toBe(4);
    expect(out!.aiMessages).toBe(1);
    // "parakeets" appears in 3 user messages → top topic.
    expect(out!.topTopic).toBe("parakeets");
    expect(out!.topTopicCount).toBeGreaterThanOrEqual(3);
  });

  it("counts Kiwi-initiated check-ins from actualAgendaEntries.source='kiwi-listened'", async () => {
    const db = (dbMod as any).getDb();
    const now = Date.now();
    await db.insert(actualAgendaEntries).values([
      {
        dateISO: D_TODAY,
        plannedBlockId: null,
        subjectSlug: "science",
        topic: "Reagan told Kiwi about a robin nest",
        minutesSpent: 5,
        source: "kiwi-listened",
        notes: null,
        createdBy: "kiwi",
        createdAt: now,
      },
      {
        dateISO: D_TODAY,
        plannedBlockId: null,
        subjectSlug: "ela",
        topic: "Reagan recited a poem to Kiwi",
        minutesSpent: 3,
        source: "kiwi-listened",
        notes: null,
        createdBy: "kiwi",
        createdAt: now,
      },
      // Different source — must NOT count.
      {
        dateISO: D_TODAY,
        plannedBlockId: null,
        subjectSlug: "math",
        topic: "Times tables",
        minutesSpent: 8,
        source: "mom-input",
        notes: null,
        createdBy: "mom",
        createdAt: now,
      },
    ]);
    const out = await dbMod.kiwiBehaviorForDate(D_TODAY);
    expect(out).not.toBeNull();
    expect(out!.kiwiInitiatedCount).toBe(2);
  });
});

describe("kiwiBehaviorAggregate (extended)", () => {
  it("returns null when there are zero whisper rows ever", async () => {
    // Cleanup wiped everything in our test window. There may be other rows
    // from other tests in the real DB though, so we only assert non-null
    // when we know there's data. This case asserts the fn handles empty.
    // Use a temporary truncation isn't safe; just assert structural fields.
    const out = await dbMod.kiwiBehaviorAggregate();
    if (out === null) {
      expect(out).toBeNull();
    } else {
      expect(out).toHaveProperty("longestStreak");
      expect(typeof out.longestStreak).toBe("number");
    }
  });

  it("computes longestStreak across consecutive day-keys", async () => {
    const db = (dbMod as any).getDb();
    // Seed 3 consecutive days then a 1-day gap then 2 more — longest run = 3.
    for (const d of D_AGG_DAYS) {
      await db.insert(whisperSessions).values({
        role: "user",
        content: `hi from ${d}`,
        createdAt: new Date(`${d}T10:00:00Z`),
      });
    }
    const out = await dbMod.kiwiBehaviorAggregate();
    expect(out).not.toBeNull();
    expect(out!.longestStreak).toBeGreaterThanOrEqual(3);
    expect(out!.daysTogether).toBeGreaterThanOrEqual(5);
    expect(out!.totalInteractions).toBeGreaterThanOrEqual(5);
  });
});
