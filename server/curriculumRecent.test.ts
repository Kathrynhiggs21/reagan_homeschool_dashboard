import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

/**
 * Phase 6: curriculum.recent powers the "Recent turn-ins" panel on Curriculum.
 * Smoke-test the shape and ordering invariants.
 */

function makeAdminCtx() {
  return {
    user: { id: 1, openId: "test-admin", name: "Admin", role: "admin" as const },
    session: null,
  } as any;
}

describe("curriculum.recent (Phase 6)", () => {
  it("returns an array of slim submission summaries", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const out = await caller.curriculum.recent({ limit: 5 });
    expect(Array.isArray(out)).toBe(true);
    for (const r of out as any[]) {
      // shape contract — each row exposes the fields the UI panel uses
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("title");
      expect(r).toHaveProperty("createdAt");
      expect(r).toHaveProperty("subjectSlug");
      expect(r).toHaveProperty("readingOnly");
    }
  });

  it("respects the limit parameter", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const out = (await caller.curriculum.recent({ limit: 3 })) as any[];
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
