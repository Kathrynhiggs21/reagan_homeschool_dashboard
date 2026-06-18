import { describe, it, expect } from "vitest";
import {
  planTimeFixes,
  planAllTimeFixes,
  planDuplicatePendingRemovals,
  isPlaceholderPhotoUrl,
  summarizeReport,
  isNotifyWorthy,
  type SelfCheckDay,
  type PendingRow,
  type SelfCheckReport,
} from "./_lib/selfCheck";

describe("selfCheck — planTimeFixes (AM/PM leading-run repair)", () => {
  it("fixes a fully-shifted morning (whole leading run in evening band)", () => {
    const day: SelfCheckDay = {
      dateISO: "2026-06-18",
      blocks: [
        { id: 1, startTime: "21:00", sortOrder: 0 },
        { id: 2, startTime: "21:30", sortOrder: 1 },
        { id: 3, startTime: "22:00", sortOrder: 2 },
      ],
    };
    const fixes = planTimeFixes(day);
    expect(fixes.map((f) => [f.blockId, f.to])).toEqual([
      [1, "09:00"],
      [2, "09:30"],
      [3, "10:00"],
    ]);
  });

  it("repairs only the corrupted leading morning, leaves a correct afternoon", () => {
    const day: SelfCheckDay = {
      dateISO: "2026-06-18",
      blocks: [
        { id: 10, startTime: "22:00", sortOrder: 0 }, // corrupted morning
        { id: 11, startTime: "22:30", sortOrder: 1 }, // corrupted morning
        { id: 12, startTime: "12:00", sortOrder: 2 }, // correct lunch — ends run
        { id: 13, startTime: "13:00", sortOrder: 3 }, // correct afternoon
      ],
    };
    const fixes = planTimeFixes(day);
    // Only the two leading evening blocks get pulled back 12h.
    expect(fixes.map((f) => [f.blockId, f.from, f.to])).toEqual([
      [10, "22:00", "10:00"],
      [11, "22:30", "10:30"],
    ]);
  });

  it("returns no fixes for an already-correct day", () => {
    const day: SelfCheckDay = {
      dateISO: "2026-06-18",
      blocks: [
        { id: 1, startTime: "09:00", sortOrder: 0 },
        { id: 2, startTime: "10:00", sortOrder: 1 },
        { id: 3, startTime: "13:00", sortOrder: 2 },
      ],
    };
    expect(planTimeFixes(day)).toEqual([]);
  });

  it("honors explicit evening intent (does nothing)", () => {
    const day: SelfCheckDay = {
      dateISO: "2026-06-18",
      intentText: "Evening astronomy night — stargazing after dinner",
      blocks: [{ id: 1, startTime: "21:00", sortOrder: 0 }],
    };
    expect(planTimeFixes(day)).toEqual([]);
  });

  it("respects sortOrder regardless of array order", () => {
    const day: SelfCheckDay = {
      dateISO: "2026-06-18",
      blocks: [
        { id: 2, startTime: "12:00", sortOrder: 2 },
        { id: 1, startTime: "22:00", sortOrder: 0 },
      ],
    };
    const fixes = planTimeFixes(day);
    expect(fixes).toEqual([
      { dateISO: "2026-06-18", blockId: 1, from: "22:00", to: "10:00" },
    ]);
  });

  it("planAllTimeFixes aggregates across days", () => {
    const days: SelfCheckDay[] = [
      { dateISO: "2026-06-18", blocks: [{ id: 1, startTime: "22:00", sortOrder: 0 }] },
      { dateISO: "2026-06-19", blocks: [{ id: 2, startTime: "09:00", sortOrder: 0 }] },
      { dateISO: "2026-06-20", blocks: [{ id: 3, startTime: "23:30", sortOrder: 0 }] },
    ];
    const fixes = planAllTimeFixes(days);
    expect(fixes.map((f) => f.blockId)).toEqual([1, 3]);
  });
});

describe("selfCheck — planDuplicatePendingRemovals (conservative, hash-gated)", () => {
  it("keeps the newest row per (folder,file,hash) and removes the rest", () => {
    const rows: PendingRow[] = [
      { id: 1, targetFolder: "day_log", fileName: "2026-06-18 - Day Log.md", createdAt: 100, contentHash: "abc" },
      { id: 2, targetFolder: "day_log", fileName: "2026-06-18 - Day Log.md", createdAt: 300, contentHash: "abc" },
      { id: 3, targetFolder: "day_log", fileName: "2026-06-18 - Day Log.md", createdAt: 200, contentHash: "abc" },
    ];
    const groups = planDuplicatePendingRemovals(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids[0]).toBe(2); // newest kept
    expect(groups[0].removeIds.sort()).toEqual([1, 3]);
  });

  it("NEVER collapses same file+folder when content differs (different hash)", () => {
    const rows: PendingRow[] = [
      { id: 1, targetFolder: "day_log", fileName: "x.md", createdAt: 100, contentHash: "old" },
      { id: 2, targetFolder: "day_log", fileName: "x.md", createdAt: 300, contentHash: "new" },
    ];
    // An updated day-log superseding an older one must be left alone.
    expect(planDuplicatePendingRemovals(rows)).toEqual([]);
  });

  it("skips rows with no contentHash (cannot prove true duplicate)", () => {
    const rows: PendingRow[] = [
      { id: 1, targetFolder: "day_log", fileName: "x.md", createdAt: 100, contentHash: null },
      { id: 2, targetFolder: "day_log", fileName: "x.md", createdAt: 300, contentHash: "" },
    ];
    expect(planDuplicatePendingRemovals(rows)).toEqual([]);
  });

  it("does not touch unique rows", () => {
    const rows: PendingRow[] = [
      { id: 1, targetFolder: "day_log", fileName: "a.md", createdAt: 1, contentHash: "h1" },
      { id: 2, targetFolder: "topics_covered", fileName: "a.md", createdAt: 1, contentHash: "h1" },
      { id: 3, targetFolder: "day_log", fileName: "b.md", createdAt: 1, contentHash: "h1" },
    ];
    expect(planDuplicatePendingRemovals(rows)).toEqual([]);
  });

  it("breaks createdAt ties by id (higher id = newer)", () => {
    const rows: PendingRow[] = [
      { id: 5, targetFolder: "worksheets", fileName: "x.pdf", createdAt: null, contentHash: "same" },
      { id: 9, targetFolder: "worksheets", fileName: "x.pdf", createdAt: null, contentHash: "same" },
    ];
    const groups = planDuplicatePendingRemovals(rows);
    expect(groups[0].ids[0]).toBe(9);
    expect(groups[0].removeIds).toEqual([5]);
  });
});

describe("selfCheck — isPlaceholderPhotoUrl", () => {
  it("flags example.com and placeholder URLs", () => {
    expect(isPlaceholderPhotoUrl("https://example.com/reagan.jpg")).toBe(true);
    expect(isPlaceholderPhotoUrl("http://example.com/x.png")).toBe(true);
    expect(isPlaceholderPhotoUrl("/img/placeholder-avatar.png")).toBe(true);
  });
  it("accepts real storage URLs and empty values", () => {
    expect(isPlaceholderPhotoUrl("/manus-storage/reagan_avatar_d8d25131.png")).toBe(false);
    expect(isPlaceholderPhotoUrl(null)).toBe(false);
    expect(isPlaceholderPhotoUrl("")).toBe(false);
    expect(isPlaceholderPhotoUrl(undefined)).toBe(false);
  });
});

describe("selfCheck — summarizeReport", () => {
  const base: SelfCheckReport = {
    ranAtISO: "2026-06-18T08:00:00.000Z",
    windowDays: 16,
    timeFixes: [],
    duplicatePendingRemoved: 0,
    placeholderPhotosCleared: 0,
    clean: true,
  };

  it("returns null when clean (suppresses noisy notifications)", () => {
    expect(summarizeReport(base)).toBeNull();
  });

  it("is SILENT for routine auto-repairs (Katy: don't email me for these)", () => {
    const report: SelfCheckReport = {
      ...base,
      clean: false,
      timeFixes: [{ dateISO: "2026-06-18", blockId: 1, from: "22:00", to: "10:00" }],
      duplicatePendingRemoved: 2,
      placeholderPhotosCleared: 1,
    };
    // Repairs still recorded in the structured report, but no owner email.
    expect(isNotifyWorthy(report)).toBe(false);
    expect(summarizeReport(report)).toBeNull();
  });

  it("isNotifyWorthy is false for a clean run", () => {
    expect(isNotifyWorthy(base)).toBe(false);
  });

  it("isNotifyWorthy is false even when many repairs fired", () => {
    const report: SelfCheckReport = {
      ...base,
      clean: false,
      timeFixes: [
        { dateISO: "2026-06-18", blockId: 1, from: "22:00", to: "10:00" },
        { dateISO: "2026-06-19", blockId: 2, from: "23:00", to: "11:00" },
      ],
      duplicatePendingRemoved: 5,
      placeholderPhotosCleared: 3,
    };
    expect(isNotifyWorthy(report)).toBe(false);
    expect(summarizeReport(report)).toBeNull();
  });
});
