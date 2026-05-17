import { describe, it, expect, afterAll } from "vitest";
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
  /**
   * v2.26 (2026-05-17) — belt-and-suspenders cleanup.
   *
   * Push 57 (2026-05-13) added a per-test `finally` that deletes the probe
   * row created during the test. That guards the happy path and assertion
   * failures, but it does NOT guard:
   *   - vitest worker SIGTERM (timeout / OOM)
   *   - unhandled rejections that bypass `finally`
   *   - the `caller.books.delete` mutation itself failing (e.g. the
   *     procedure's role gate is changed and the test caller no longer
   *     passes it)
   *
   * Audit on 2026-05-17 found 10 leaked rows in production, with timestamps
   * ranging from 2026-05-09 through 2026-05-17 — i.e. leaks happened both
   * before and after Push 57. We hand-deleted them via SQL and added this
   * `afterAll` hook as a second defense: even if every per-test cleanup
   * fails, the suite as a whole always sweeps the table on its way out.
   */
  afterAll(async () => {
    try {
      const caller = makeAdminCaller();
      // listBooks intentionally hides __vitest rows from the UI, but the
      // raw delete procedure still works on them by id. We need an internal
      // un-filtered list. The simplest way is to reach the db helper.
      const dbModule = await import("./db");
      const allBooks: any[] = await (dbModule as any).listBooksRaw?.()
        ?? await (dbModule as any).listBooks?.()
        ?? [];
      for (const b of allBooks) {
        if (typeof b?.title === "string" && b.title.startsWith("__vitest_filter_probe_")) {
          try { await caller.books.delete({ id: b.id }); } catch { /* ignore */ }
        }
      }
    } catch {
      // Cleanup is best-effort; we don't want to fail the test run here.
    }
  });

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
      // an upstream procedure throws. v2.26 (2026-05-17) — kept as the
      // primary cleanup; the suite-level afterAll above is a backup.
      if (created?.id) {
        try { await caller.books.delete({ id: created.id }); } catch { /* ignore */ }
      }
    }
  });
});
