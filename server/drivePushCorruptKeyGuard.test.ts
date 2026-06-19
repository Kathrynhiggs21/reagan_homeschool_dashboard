/**
 * server/drivePushCorruptKeyGuard.test.ts
 *
 * v3.31 (2026-06-18) — Corrupt fileKey guard regression test.
 *
 * Background: two `finished_work` submission rows entered the queue with
 * fileKey === "k" (fileUrl "/manus-storage/k") — a malformed client upload.
 * The drainer could never fetch those bytes (they were never written to S3),
 * so the rows failed on every drain tick forever and could not be resynced.
 *
 * `enqueueDrivePush` now refuses any BINARY push (no inline contentText) whose
 * fileKey is <= 2 chars. Inline-text pushes are exempt (they carry their own
 * bytes and don't need an S3 key). This test pins that behavior.
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

describe("enqueueDrivePush — corrupt fileKey guard", () => {
  it('throws on the historical poison key "k" for a binary push', async () => {
    const m = makeMock();
    await expect(
      enqueueDrivePush(
        {
          fileKey: "k",
          fileUrl: "/manus-storage/k",
          fileName: "2026-06-18 - Block_333 - submission_1001",
          targetFolder: "finished_work" as any,
        },
        { dbOverride: m.db },
      ),
    ).rejects.toThrow(/implausible fileKey/);
    expect(m.inserted).toHaveLength(0);
  });

  it("throws on empty and single/double-char keys (binary push)", async () => {
    for (const k of ["", " ", "k", "ab", "  x "]) {
      const m = makeMock();
      await expect(
        enqueueDrivePush(
          {
            fileKey: k,
            fileUrl: "/manus-storage/" + k.trim(),
            fileName: "x.pdf",
            targetFolder: "finished_work" as any,
          },
          { dbOverride: m.db },
        ),
      ).rejects.toThrow(/implausible fileKey/);
      expect(m.inserted).toHaveLength(0);
    }
  });

  it("permits a plausible S3 key for a binary push", async () => {
    const m = makeMock();
    const out = await enqueueDrivePush(
      {
        fileKey: "worksheets/2026-06-18/p180001_eafc3555_506ded48.pdf",
        fileUrl: "/manus-storage/worksheets/2026-06-18/p180001_eafc3555_506ded48.pdf",
        fileName: "Science_Adventure__2026-06-18.pdf",
        targetFolder: "reagan_assignments" as any,
      },
      { dbOverride: m.db },
    );
    expect(out.outcome).toBe("new");
    expect(m.inserted).toHaveLength(1);
  });

  it("exempts inline-text pushes (no S3 key needed)", async () => {
    const m = makeMock();
    const out = await enqueueDrivePush(
      {
        // Inline markdown day-log: short/placeholder key is fine because the
        // bytes travel inline in contentText, not via S3.
        fileKey: "k",
        fileUrl: "",
        fileName: "2026-06-18 - art - daylog.md",
        targetFolder: "topics_covered" as any,
        contentText: "# Day log\n\nReagan covered art today.",
      } as any,
      { dbOverride: m.db },
    );
    expect(out.outcome).toBe("new");
    expect(m.inserted).toHaveLength(1);
  });
});
