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
    const created: any = await caller.books.create({
      title,
      author: "probe",
      type: "workbook",
      currentPage: 0,
      totalPages: 10,
    });
    const rows: any[] = await caller.books.list();
    expect(rows.find((b) => b.title === title)).toBeUndefined();
    // cleanup
    if (created?.id) await caller.books.delete({ id: created.id });
  });
});
