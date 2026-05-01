import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { whiteboardNotes } from "../drizzle/schema";

const db = getDb();

describe("whiteboardNotes cleanliness", () => {
  it("contains no demo 'Test note' or 'Tomorrow only' rows", async () => {
    const all = await db
      .select({ id: whiteboardNotes.id, title: whiteboardNotes.title, body: whiteboardNotes.body })
      .from(whiteboardNotes);
    const offenders = all.filter(
      (r) =>
        (r.title || "").trim() === "Test note" ||
        ((r.title || "") === "" && (r.body || "").trim() === "Tomorrow only") ||
        (r.title == null && (r.body || "").trim() === "Tomorrow only"),
    );
    expect(offenders, `Offenders: ${JSON.stringify(offenders.slice(0, 5))}`).toEqual([]);
  });
});
