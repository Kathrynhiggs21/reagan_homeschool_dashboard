import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

function makeAdminCaller() {
  return (appRouter as any).createCaller({
    user: {
      id: 1,
      openId: "owner",
      email: "owner@test",
      role: "admin",
      name: "Test Owner",
    },
    req: null,
    res: null,
  });
}

describe("books: listBooks filters __vitest-titled rows from UI", () => {
  it("hides any book whose title contains __vitest even if it exists in DB", async () => {
    const caller = makeAdminCaller();
    const title = "__vitest_filter_probe_" + Date.now();
    let created: any = null;
    try {
      created = await caller.books.create({
        title,
        author: "probe",
        type: "workbook",
        currentPage: 0,
        totalPages: 10,
      });
      const rows: any[] = await caller.books.list();
      expect(rows.find((b) => b.title === title)).toBeUndefined();
    } finally {
      // Push 57 (2026-05-13) — guarantee cleanup even when the assertion or
      // an upstream procedure throws. Without this `finally`, every aborted
      // test run leaks a row into the `books` table that listBooks then has
      // to filter forever. We surfaced 150 such rows in production and
      // hand-deleted them; this finally block prevents the next leak.
      if (created?.id) {
        try { await caller.books.delete({ id: created.id }); } catch { /* ignore */ }
      }
    }
  });
});
