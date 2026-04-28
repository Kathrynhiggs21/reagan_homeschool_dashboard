import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("Review library / TV box", () => {
  it("seeds starters on first call, idempotent afterwards", async () => {
    await db.seedStarterTVIfEmpty();
    const all = await db.listReviewResources({ approvedOnly: true });
    expect(all.length).toBeGreaterThan(0);
    const again = await db.seedStarterTVIfEmpty();
    expect(again.seeded).toBe(false);
  });

  it("can add, filter by kind/subject, approve/unapprove, and delete", async () => {
    const { id } = await db.addReviewResource({
      topic: "test", title: "Test video", kind: "youtube",
      youtubeId: "test" + Date.now(),
      subjectSlug: "brain-break", approved: false,
    });
    expect(id).toBeGreaterThan(0);

    const approvedOnly = await db.listReviewResources({ approvedOnly: true });
    expect(approvedOnly.find((r: any) => r.id === id)).toBeUndefined();

    await db.setReviewResourceApproval(id, true);
    const now = await db.listReviewResources({ approvedOnly: true, subjectSlug: "brain-break" });
    expect(now.find((r: any) => r.id === id)).toBeTruthy();

    await db.deleteReviewResource(id);
  });
});
