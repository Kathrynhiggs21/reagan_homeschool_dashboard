/**
 * server/drivePushPlaceholderGuard.test.ts
 *
 * v3.24 (2026-05-31) — Placeholder-URL guard regression test.
 *
 * Background: a pre-dbOverride iteration of `drivePushDedupe.test.ts` ran
 * against the real TiDB pool and inserted 4 rows whose `fileUrl` was the
 * literal placeholder string `/manus-storage/<dir>/...` (URL ends in three
 * dots). The drainer then 403'd trying to fetch those non-existent S3
 * objects.
 *
 * `enqueueDrivePush` now refuses any row whose fileUrl ends in `/...`.
 * This test pins that behavior so a future regression is loud.
 */

import { describe, it, expect } from "vitest";
import { enqueueDrivePush } from "./db";

function makeMock() {
  const inserted: any[] = [];
  return {
    inserted,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [],
            }),
          }),
        }),
      }),
      insert: () => ({
        values: async (v: any) => {
          inserted.push(v);
          return [{ insertId: 1 }];
        },
      }),
    },
  };
}

describe("enqueueDrivePush — placeholder fileUrl guard", () => {
  it("throws when fileUrl ends in `/...` literal", async () => {
    const m = makeMock();
    await expect(
      enqueueDrivePush(
        {
          fileKey: "agendas/2026-06-01/v1.pdf",
          fileUrl: "/manus-storage/agendas/...",
          fileName: "2026-06-01 - Reagan - Agenda.pdf",
          targetFolder: "agenda_pdf" as any,
        },
        { dbOverride: m.db },
      ),
    ).rejects.toThrow(/refused placeholder fileUrl/);
    expect(m.inserted).toHaveLength(0);
  });

  it("throws on each of the four historical leaked URL shapes", async () => {
    const cases = [
      "/manus-storage/agendas/...",
      "/manus-storage/daylogs/...",
      "/manus-storage/topics/...",
      "/manus-storage/recap/...",
    ];
    for (const url of cases) {
      const m = makeMock();
      await expect(
        enqueueDrivePush(
          {
            fileKey: "k/" + url,
            fileUrl: url,
            fileName: "x.md",
            targetFolder: "day_log" as any,
          },
          { dbOverride: m.db },
        ),
      ).rejects.toThrow(/refused placeholder fileUrl/);
      expect(m.inserted).toHaveLength(0);
    }
  });

  it("trims whitespace before checking", async () => {
    const m = makeMock();
    await expect(
      enqueueDrivePush(
        {
          fileKey: "k.md",
          fileUrl: "  /manus-storage/x/...  ",
          fileName: "x.md",
          targetFolder: "day_log" as any,
        },
        { dbOverride: m.db },
      ),
    ).rejects.toThrow(/refused placeholder fileUrl/);
  });

  it("permits a real-looking fileUrl (no trailing /...) and inserts normally", async () => {
    const m = makeMock();
    const out = await enqueueDrivePush(
      {
        fileKey: "k.md",
        fileUrl: "/manus-storage/agendas/2026-06-01/v1.pdf",
        fileName: "v1.pdf",
        targetFolder: "agenda_pdf" as any,
      },
      { dbOverride: m.db },
    );
    expect(out.outcome).toBe("new");
    expect(m.inserted).toHaveLength(1);
    expect(m.inserted[0].fileUrl).toBe(
      "/manus-storage/agendas/2026-06-01/v1.pdf",
    );
  });

  it("does NOT trip on a URL containing `...` mid-path (only literal trailing /...)", async () => {
    const m = makeMock();
    const out = await enqueueDrivePush(
      {
        fileKey: "weird.md",
        // Three dots mid-path, not at end after a slash. This is a
        // legal-if-ugly URL; we should still accept it.
        fileUrl: "/manus-storage/weird.../actually-real.md",
        fileName: "actually-real.md",
        targetFolder: "day_log" as any,
      },
      { dbOverride: m.db },
    );
    expect(out.outcome).toBe("new");
    expect(m.inserted).toHaveLength(1);
  });

  it("rejects an empty string after trim that ends in /... (defensive)", async () => {
    // Synthesize an obviously bogus value to confirm the regex anchors to end-of-string.
    const m = makeMock();
    await expect(
      enqueueDrivePush(
        {
          fileKey: "k.md",
          fileUrl: "/...",
          fileName: "x",
          targetFolder: "day_log" as any,
        },
        { dbOverride: m.db },
      ),
    ).rejects.toThrow(/refused placeholder fileUrl/);
  });
});
