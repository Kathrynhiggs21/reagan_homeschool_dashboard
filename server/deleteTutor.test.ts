import { describe, it, expect } from "vitest";
import { tutors, tutorSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as db from "./db";

const getDb = (db as any).getDb;

/**
 * Slice 4 push 12 (2026-05-12) — locks the contract for tutors.delete:
 *   - If a tutor has zero sessions on file → hard-delete the row.
 *   - If a tutor has at least one session on file → preserve the row but flip
 *     active=false. History stays intact.
 */
describe("Slice 4 push 12 — deleteTutor preserves history when sessions exist", () => {
  it("hard-deletes a tutor with no sessions", async () => {
    const dbi = getDb();
    const [r] = await dbi.insert(tutors).values({
      name: `Test Tutor No Sessions ${Date.now()}`,
      role: "Test",
      active: true,
    } as any) as any;
    const tutorId = r?.insertId as number;
    expect(tutorId).toBeGreaterThan(0);

    const result = await db.deleteTutor(tutorId);
    expect(result).toEqual({ deleted: true, deactivated: false });

    const found = await dbi.select().from(tutors).where(eq(tutors.id, tutorId));
    expect(found.length).toBe(0);
  });

  it("soft-deletes (active=false) when sessions exist", async () => {
    const dbi = getDb();
    const [r] = await dbi.insert(tutors).values({
      name: `Test Tutor With Sessions ${Date.now()}`,
      role: "Test",
      active: true,
    } as any) as any;
    const tutorId = r?.insertId as number;
    expect(tutorId).toBeGreaterThan(0);

    // Seed a session
    await dbi.insert(tutorSessions).values({
      tutorId,
      scheduledAt: new Date(),
      durationMin: 60,
      status: "completed",
      sessionNotes: "test session",
    } as any);

    const result = await db.deleteTutor(tutorId);
    expect(result).toEqual({ deleted: false, deactivated: true });

    // Tutor row preserved; active flipped to false
    const found = await dbi.select().from(tutors).where(eq(tutors.id, tutorId));
    expect(found.length).toBe(1);
    expect(Boolean(found[0].active)).toBe(false);

    // Session history preserved
    const sess = await dbi.select().from(tutorSessions).where(eq(tutorSessions.tutorId, tutorId));
    expect(sess.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    await dbi.delete(tutorSessions).where(eq(tutorSessions.tutorId, tutorId));
    await dbi.delete(tutors).where(eq(tutors.id, tutorId));
  });
});
