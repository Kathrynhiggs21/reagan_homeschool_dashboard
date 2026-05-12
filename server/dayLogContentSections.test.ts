import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  tutorSessions,
  dailyRecapRequests,
} from "../drizzle/schema";
import * as dbMod from "./db";
import { buildDayLogMarkdown, formatDayLogMarkdown } from "./_lib/dayLogBuilder";
import { loadDayLogPayload } from "./_lib/dayLogBuilder";

/**
 * Slice 4.5 push 8 PART 2 (2026-05-12):
 *   The day log markdown must include four new sections beyond the
 *   prior Planned / Actual / Off-plan content:
 *     - ## Completed work
 *     - ## Curriculum coverage
 *     - ## Tutor notes
 *     - ## Recap replies
 *
 *   This test seeds real DB rows for each source and asserts the section
 *   header AND the seeded content appear in the rendered markdown for
 *   that date.
 */

const D_NOTES = "2032-03-04";
const D_REPLY = "2032-03-05";

async function clean() {
  const db = (dbMod as any).getDb();
  // tutorSessions: delete by scheduledAt date range
  const startNotes = new Date(`${D_NOTES}T00:00:00Z`);
  const endNotes = new Date(startNotes.getTime() + 24 * 60 * 60 * 1000);
  const allTs: any[] = await db.select().from(tutorSessions);
  for (const row of allTs) {
    const ms = row?.scheduledAt ? new Date(row.scheduledAt).getTime() : 0;
    if (ms >= startNotes.getTime() && ms < endNotes.getTime()) {
      await db.delete(tutorSessions).where(eq(tutorSessions.id, row.id));
    }
  }
  // recap rows for D_REPLY
  await db
    .delete(dailyRecapRequests)
    .where(eq(dailyRecapRequests.dateISO, D_REPLY));
}

beforeAll(async () => {
  await clean();
});
afterAll(async () => {
  try {
    await clean();
  } catch {
    /* ignore */
  }
});

describe("Day Log content sections — Slice 4.5 push 8 PART 2", () => {
  it("formatDayLogMarkdown always renders the four new section headers (even when empty)", () => {
    const md = formatDayLogMarkdown({
      dateISO: "2032-01-01",
      planExists: false,
      isWeekend: false,
      isAbsence: false,
      absenceReason: null,
      plannedBlocks: [],
      actualEntries: [],
      offPlanTopics: [],
      totalActualMinutes: 0,
      plannedComplete: 0,
      plannedTotal: 0,
      completedWork: [],
      coverage: [],
      tutorNotes: [],
      recapReplies: [],
    });
    expect(md).toContain("## Completed work");
    expect(md).toContain("(no blocks marked complete yet)");
    expect(md).toContain("## Curriculum coverage");
    expect(md).toContain("(no curriculum standards mapped yet)");
    expect(md).toContain("## Tutor notes");
    expect(md).toContain("(no tutor sessions recorded for this date)");
    expect(md).toContain("## Recap replies");
    expect(md).toContain("(no recap replies for this date)");
  });

  it("formatDayLogMarkdown renders completed work + coverage rows from payload", () => {
    const md = formatDayLogMarkdown({
      dateISO: "2032-01-02",
      planExists: true,
      isWeekend: false,
      isAbsence: false,
      absenceReason: null,
      plannedBlocks: [],
      actualEntries: [],
      offPlanTopics: [],
      totalActualMinutes: 0,
      plannedComplete: 1,
      plannedTotal: 2,
      completedWork: [
        {
          title: "Read aloud chapter 3",
          subjectSlug: "ela",
          completedAtISO: "2032-01-02T15:30:00.000Z",
        },
      ],
      coverage: [
        { subjectSlug: "math", done: 4, total: 10, pct: 40 },
        { subjectSlug: "ela", done: 7, total: 10, pct: 70 },
      ],
      tutorNotes: [],
      recapReplies: [],
    });
    expect(md).toContain("Read aloud chapter 3");
    expect(md).toContain("[ela]");
    expect(md).toContain("completed 2032-01-02T15:30:00.000Z");
    expect(md).toContain("**math**: 4/10 (40%)");
    expect(md).toContain("**ela**: 7/10 (70%)");
  });

  it("formatDayLogMarkdown renders tutor notes + recap reply quote", () => {
    const md = formatDayLogMarkdown({
      dateISO: "2032-01-03",
      planExists: false,
      isWeekend: false,
      isAbsence: false,
      absenceReason: null,
      plannedBlocks: [],
      actualEntries: [],
      offPlanTopics: [],
      totalActualMinutes: 0,
      plannedComplete: 0,
      plannedTotal: 0,
      completedWork: [],
      coverage: [],
      tutorNotes: [
        {
          scheduledAtISO: "2032-01-03T18:00:00.000Z",
          durationMin: 45,
          status: "completed",
          focus: "Word problems",
          sessionNotes: "Strong with addition; struggled with carrying.",
        },
      ],
      recapReplies: [
        {
          sentTo: "marcy@example.com",
          status: "replied",
          rawReplyText: "We did read aloud and a math worksheet.",
          parsedEntriesCount: 2,
        },
      ],
    });
    expect(md).toContain("2032-01-03T18:00:00.000Z");
    expect(md).toContain("45 min");
    expect(md).toContain("completed");
    expect(md).toContain("focus: Word problems");
    expect(md).toContain("Strong with addition; struggled with carrying.");
    expect(md).toContain("**marcy@example.com**");
    expect(md).toContain("replied");
    expect(md).toContain("2 entries parsed");
    expect(md).toContain(
      "We did read aloud and a math worksheet.",
    );
  });

  it("buildDayLogMarkdown end-to-end: real tutor session + recap reply rows show up", async () => {
    const db = (dbMod as any).getDb();

    // Seed a tutor session inside the date window.
    await db.insert(tutorSessions).values({
      tutorId: 1,
      scheduledAt: new Date(`${D_NOTES}T17:00:00Z`),
      durationMin: 30,
      location: "Living room",
      focus: "Multiplication tables",
      status: "completed" as any,
      sessionNotes: "Got 7s and 8s; 9s still shaky.",
    });

    const md1 = await buildDayLogMarkdown(D_NOTES);
    expect(md1).toContain("## Tutor notes");
    expect(md1).toContain("30 min");
    expect(md1).toContain("focus: Multiplication tables");
    expect(md1).toContain("Got 7s and 8s; 9s still shaky.");

    // Seed a recap reply row for a different date.
    await db.insert(dailyRecapRequests).values({
      dateISO: D_REPLY,
      sentTo: "grandma@example.com",
      replyToken: "tok-content-test-" + Date.now(),
      sentAt: Date.now(),
      status: "replied" as any,
      rawReplyText:
        "Reagan listened to a chapter and we worked on phonics for 20 min.",
      parsedEntriesCount: 3,
    } as any);

    const md2 = await buildDayLogMarkdown(D_REPLY);
    expect(md2).toContain("## Recap replies");
    expect(md2).toContain("**grandma@example.com**");
    expect(md2).toContain("3 entries parsed");
    expect(md2).toContain("Reagan listened to a chapter");
  });

  it("loadDayLogPayload populates the four new fields for any date (best-effort, never throws)", async () => {
    const p = await loadDayLogPayload("2099-12-31");
    expect(Array.isArray(p.completedWork)).toBe(true);
    expect(Array.isArray(p.coverage)).toBe(true);
    expect(Array.isArray(p.tutorNotes)).toBe(true);
    expect(Array.isArray(p.recapReplies)).toBe(true);
  });
});
