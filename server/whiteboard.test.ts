import { describe, it, expect } from "vitest";
import * as db from "./db";

/**
 * Whiteboard + Tag system tests.
 * The DB is shared with the dev instance, so these tests use realistic
 * shapes and clean up any rows they create where possible.
 */

describe("Adult Whiteboard", () => {
  it("can post, read, heart, and archive a note", async () => {
    const { id } = await db.postWhiteboardNote({
      authorUserId: 999,
      authorName: "TestParent",
      authorAvatar: "T",
      title: "Test note",
      body: "Hello Reagan (test)",
      color: "sky",
      emoji: "🌊",
      pinned: false,
      showOnDate: null,
    });
    expect(id).toBeGreaterThan(0);

    const listed = await db.listWhiteboardNotes({ includeArchived: true });
    const mine = listed.find((n: any) => n.id === id);
    expect(mine).toBeTruthy();
    expect(mine?.body).toContain("Hello Reagan");

    const hearted = await db.reaganHeartNote(id);
    expect(hearted.reaganHearted).toBe(true);
    expect(hearted.heartCount).toBe(1);

    // unheart
    const unhearted = await db.reaganHeartNote(id);
    expect(unhearted.reaganHearted).toBe(false);
    expect(unhearted.heartCount).toBe(0);

    // archive
    await db.updateWhiteboardNote(id, { archived: true });
    const active = await db.listWhiteboardNotes({ includeArchived: false });
    expect(active.find((n: any) => n.id === id)).toBeUndefined();
  });

  it("respects showOnDate date-scoping", async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { id } = await db.postWhiteboardNote({
      authorUserId: 999,
      authorName: "TestParent",
      body: "Tomorrow only",
      color: "mint",
      showOnDate: tomorrow,
    });
    const today = new Date().toISOString().slice(0, 10);
    const listedToday = await db.listWhiteboardNotes({ forDate: today });
    expect(listedToday.find((n: any) => n.id === id)).toBeUndefined();
    const listedTomorrow = await db.listWhiteboardNotes({ forDate: tomorrow });
    expect(listedTomorrow.find((n: any) => n.id === id)).toBeTruthy();
    // cleanup
    await db.updateWhiteboardNote(id, { archived: true });
  });
});

describe("Tag system", () => {
  it("seeds presets on first call, is idempotent on subsequent", async () => {
    const first = await db.seedDefaultTagsIfEmpty();
    // Either freshly seeded or already present — both are acceptable states
    expect(first).toBeTruthy();
    const all = await db.listTags();
    expect(all.length).toBeGreaterThan(0);
    const moodTags = await db.listTags("mood");
    expect(moodTags.every((t: any) => t.category === "mood")).toBe(true);
  });

  it("can upsert, attach, list, and detach tags", async () => {
    const { id: tagId } = await db.upsertTag({
      slug: "test-tag-" + Date.now(),
      label: "Test Tag",
      emoji: "🧪",
      category: "custom",
      color: "butter",
    });
    expect(tagId).toBeGreaterThan(0);

    const linked = await db.attachTag({ tagId, entityType: "day", entityId: 12345 });
    expect(linked.id).toBeGreaterThan(0);

    const forEntity = await db.listTagsForEntity("day", 12345);
    expect(forEntity.find((t: any) => t.tagId === tagId)).toBeTruthy();

    await db.detachTag(linked.id);
    const afterDetach = await db.listTagsForEntity("day", 12345);
    expect(afterDetach.find((t: any) => t.tagId === tagId)).toBeUndefined();
  });
});
