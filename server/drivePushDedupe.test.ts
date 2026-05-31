/**
 * server/drivePushDedupe.test.ts
 *
 * Phase 5 routing audit (2026-05-29) — dedupe gate in `enqueueDrivePush`.
 *
 * Contract:
 *  - if an existing row with the same (fileKey, targetFolder) is `pending`,
 *    return its id with deduplicated=true (no second insert)
 *  - same for status `pushed`
 *  - status `failed` or `skipped` => allow a fresh enqueue (insert proceeds)
 *  - missing row => fresh insert
 *
 * We use the `dbOverride` option that enqueueDrivePush accepts for tests so
 * we never touch the real TiDB pool.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { enqueueDrivePush } from "./db";

type Row = {
  id: number;
  fileKey: string;
  targetFolder: string;
  status: "pending" | "pushed" | "skipped" | "failed";
};
let rows: Row[] = [];
let nextId = 1000;
let inserted: any[] = [];

function makeFluentMock(): any {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              const sorted = [...rows].sort((a, b) => b.id - a.id);
              return sorted.length > 0 ? [sorted[0]] : [];
            },
          }),
        }),
      }),
    }),
    insert: () => ({
      values: async (v: any) => {
        const id = nextId++;
        inserted.push({ id, ...v });
        rows.push({
          id,
          fileKey: v.fileKey,
          targetFolder: v.targetFolder,
          status: v.status ?? "pending",
        });
        return [{ insertId: id }];
      },
    }),
  };
}

beforeEach(() => {
  rows = [];
  nextId = 1000;
  inserted = [];
});

describe("enqueueDrivePush dedupe gate", () => {
  it("returns the existing id with deduplicated=true when a pending row already exists", async () => {
    rows.push({
      id: 42,
      fileKey: "agendas/2026-06-01/v1.pdf",
      targetFolder: "agenda_pdf",
      status: "pending",
    });
    const out = await enqueueDrivePush(
      {
        fileKey: "agendas/2026-06-01/v1.pdf",
        fileUrl: "/manus-storage/agendas/2026-06-01/v1.pdf",
        fileName: "2026-06-01 - Reagan - Agenda.pdf",
        targetFolder: "agenda_pdf" as any,
      },
      { dbOverride: makeFluentMock() },
    );
    expect(out.id).toBe(42);
    expect(out.deduplicated).toBe(true);
    expect(out.outcome).toBe("dup_pending");
    expect(inserted).toHaveLength(0);
  });

  it("dedupes by content hash when the bytes match an already-pushed row in the same folder", async () => {
    // A row with a different fileKey but matching content hash already exists
    // in the same target folder. We expect outcome="dup_hash" and no insert.
    const sha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    rows.push({
      id: 17,
      fileKey: "old/key/that/already/landed.pdf",
      targetFolder: "agenda_pdf",
      status: "pushed",
      // @ts-expect-error — mock row carries an extra field
      contentHash: sha,
    });
    // Override the mock so the where().limit() return depends on which
    // dedupe pass it is. Pass 1 (fileKey) won't match, pass 2 (hash) will.
    let call = 0;
    const hashAwareMock: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => {
                call += 1;
                if (call === 1) return []; // pass 1: no fileKey match
                // pass 2: hash match — return the row with the same hash
                const m = rows.find((r: any) => r.contentHash === sha);
                return m ? [m] : [];
              },
            }),
          }),
        }),
      }),
      insert: () => ({
        values: async (v: any) => {
          inserted.push(v);
          return [{ insertId: 999 }];
        },
      }),
    };
    const out = await enqueueDrivePush(
      {
        fileKey: "new/key/different/path.pdf",
        fileUrl: "/manus-storage/new/key/different/path.pdf",
        fileName: "2026-06-01 - Reagan - Agenda.pdf",
        targetFolder: "agenda_pdf" as any,
        contentHash: sha,
      },
      { dbOverride: hashAwareMock },
    );
    expect(out.id).toBe(17);
    expect(out.deduplicated).toBe(true);
    expect(out.outcome).toBe("dup_hash");
    expect(inserted).toHaveLength(0);
  });

  it("returns the existing id when the previous row was already pushed", async () => {
    rows.push({
      id: 7,
      fileKey: "daylogs/2026-05-30.md",
      targetFolder: "day_log",
      status: "pushed",
    });
    const out = await enqueueDrivePush(
      {
        fileKey: "daylogs/2026-05-30.md",
        fileUrl: "/manus-storage/daylogs/2026-05-30.md",
        fileName: "2026-05-30 - Day Log.md",
        targetFolder: "day_log" as any,
      },
      { dbOverride: makeFluentMock() },
    );
    expect(out.id).toBe(7);
    expect(out.deduplicated).toBe(true);
    expect(inserted).toHaveLength(0);
  });

  it("allows a fresh enqueue when the previous row failed", async () => {
    rows.push({
      id: 9,
      fileKey: "topics/2026-05-30/math-fractions.md",
      targetFolder: "topics_covered",
      status: "failed",
    });
    const out = await enqueueDrivePush(
      {
        fileKey: "topics/2026-05-30/math-fractions.md",
        fileUrl: "/manus-storage/topics/2026-05-30/math-fractions.md",
        fileName: "math-fractions.md",
        targetFolder: "topics_covered" as any,
      },
      { dbOverride: makeFluentMock() },
    );
    expect(out.deduplicated).toBeUndefined();
    expect(out.outcome).toBe("new");
    expect(inserted).toHaveLength(1);
    expect(inserted[0].fileKey).toBe("topics/2026-05-30/math-fractions.md");
    expect(inserted[0].dedupeOutcome).toBe("new");
  });

  it("inserts when no prior row exists", async () => {
    const out = await enqueueDrivePush(
      {
        fileKey: "recap/2026-05-30/marcy.md",
        fileUrl: "/manus-storage/recap/2026-05-30/marcy.md",
        fileName: "2026-05-30 - marcy.spear - Recap.md",
        targetFolder: "recap_reply" as any,
      },
      { dbOverride: makeFluentMock() },
    );
    expect(out.deduplicated).toBeUndefined();
    expect(out.id).toBeGreaterThan(0);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].targetFolder).toBe("recap_reply");
  });

  it("dedupes by (fileKey + targetFolder) compound key — same file in different folders is NOT a dup", async () => {
    // The prior row exists in `day_log`; a new enqueue under `agenda_pdf`
    // is a different routing target and must NOT be deduped.
    rows.push({
      id: 11,
      fileKey: "shared.md",
      targetFolder: "day_log",
      status: "pushed",
    });
    // Make the fluent mock filter on targetFolder so the test mirrors the real
    // WHERE clause behavior — only the (fileKey, targetFolder) compound match
    // counts as a duplicate.
    const filteredMock: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => {
                // Mimic the compound filter (fileKey + targetFolder).
                const match = rows.filter(
                  (r) => r.fileKey === "shared.md" && r.targetFolder === "agenda_pdf",
                );
                return match.length > 0 ? [match[match.length - 1]] : [];
              },
            }),
          }),
        }),
      }),
      insert: () => ({
        values: async (v: any) => {
          const id = nextId++;
          inserted.push({ id, ...v });
          rows.push({
            id,
            fileKey: v.fileKey,
            targetFolder: v.targetFolder,
            status: v.status ?? "pending",
          });
          return [{ insertId: id }];
        },
      }),
    };
    const out = await enqueueDrivePush(
      {
        fileKey: "shared.md",
        fileUrl: "/manus-storage/shared.md",
        fileName: "shared.md",
        targetFolder: "agenda_pdf" as any,
      },
      { dbOverride: filteredMock },
    );
    expect(out.deduplicated).toBeUndefined();
    expect(inserted).toHaveLength(1);
    expect(inserted[0].targetFolder).toBe("agenda_pdf");
  });
});
